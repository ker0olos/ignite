import type {
  ModelInfo,
  SessionState,
  OpenedSession,
} from "../shared/hostProtocol.ts";
import type { ImageContent, SessionEvent } from "../shared/agentTypes.ts";
import type { QueueKind } from "../shared/queue.ts";
import {
  current,
  isShown,
  target,
  type Agent,
  type HostContext,
  type McpStatusSnapshot,
  type Session,
} from "./hostTypes.ts";
import { describeError, toWireEvent } from "./wire.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import { rememberSignIns, pushMcpServers } from "./hostMcp.ts";
import { askApproval, denyAll } from "./hostApproval.ts";
import { claudeLoggedIn } from "./hostAuth.ts";
import { followSubagents, subagentsIn } from "./hostChildren.ts";
import { firstTitle, titleOf } from "../shared/conversations.ts";
import { pushProjects, trackRun } from "./hostProjects.ts";
import { resume } from "./hostResume.ts";
import { delivered, rememberImages } from "./queuedImages.ts";

const info = ({ provider, id, name }: ModelInfo): ModelInfo => ({
  provider,
  id,
  name,
});

// Everything comes from pi: the connected providers' models, and the levels
// the session's model supports (pi clamps the level itself).
/** Returns the session's models and effort levels. */
export async function sessionState(
  ctx: HostContext,
  s?: Session,
): Promise<SessionState> {
  s ??= await current(ctx);
  const [models, claude] = await Promise.all([
    s.modelRuntime.getAvailable(),
    claudeLoggedIn(ctx),
  ]);
  // The bridge lists its models whether or not Claude Code is signed in.
  const usable = models.filter((m) => m.provider !== "claude-bridge" || claude);
  return {
    models: usable.map(info),
    model: s.model && info(s.model),
    thinkingLevel: s.thinkingLevel,
    thinkingLevels: s.getAvailableThinkingLevels(),
    skills: s.resourceLoader
      .getSkills()
      .skills.map(({ name, description }) => ({ name, description })),
  };
}

/** Changes the session's model and persists it for future sessions. */
export async function setModel(
  ctx: HostContext,
  provider: string,
  modelId: string,
  session?: string,
) {
  const s = await current(ctx, session);
  const model = (await s.modelRuntime.getAvailable()).find(
    (m) => m.provider === provider && m.id === modelId,
  );
  if (!model) throw new Error(`${modelId} isn't available.`);
  // Persisted so the next session starts with the same choice.
  await s.setModel(model, { persist: true });
  return sessionState(ctx, s);
}

// The last one shown, else another one open; a folder may have none.
function reopened(ctx: HostContext, cwd: string): string | undefined {
  const last = ctx.lastShown.get(cwd);
  if (last && ctx.agents.has(last)) return last;
  return [...ctx.agents.values()].find((a) => a.cwd === cwd)?.id;
}

/**
 * Shows one of a folder's conversations, starting its session unless it's
 * already open, and returns its state. Without `id`, the one `reopened`
 * finds, or null: showing a folder never starts a conversation.
 */
export async function open(
  ctx: HostContext,
  cwd: string,
  id = reopened(ctx, cwd),
): Promise<OpenedSession | null> {
  if (id === undefined) {
    ctx.shown = null;
    await pushMcpServers(ctx);
    return null;
  }
  ctx.shown = id;
  ctx.lastShown.set(cwd, id);
  ctx.checking.clear();
  const started = ctx.agents.get(id);
  const agent = started ?? start(ctx, cwd, id);
  const s = await agent.opening;
  // After the reply, so the app is following the session when the run starts;
  // and like a prompt, once the worktree's ignored files are in.
  if (!started) {
    setTimeout(() => {
      agent.ready.then(() => resume(s)).catch(reportTo(ctx, agent));
    });
  }
  // Servers now have a status, even before the adapter reports any.
  if (isShown(ctx, agent)) await pushMcpServers(ctx);
  return {
    ...(await sessionState(ctx, s)),
    session: id,
    workdir: agent.workdir,
    trust: ctx.trust.get(cwd),
    messages: s.messages,
    running: s.isStreaming,
    ...(s.modelWarning && { modelWarning: s.modelWarning }),
    approvals: [...agent.approvals.values()].map((ask) => ask.request),
    queue: {
      steering: [...s.getSteeringMessages()],
      followUp: [...s.getFollowUpMessages()],
    },
  };
}

/** Opens conversation `id` in the background, without showing it. */
export async function launch(ctx: HostContext, cwd: string, id: string) {
  await (ctx.agents.get(id) ?? start(ctx, cwd, id)).opening;
}

function start(ctx: HostContext, cwd: string, id: string): Agent {
  const agent = {
    id,
    cwd,
    workdir: cwd,
    title: "",
    ready: Promise.resolve(),
    session: null,
    running: false,
    unsubscribe: () => {},
    mcpStatus: new Map(),
    reloadWhenSettled: false,
    approvals: new Map(),
    queuedImages: new Map(),
    subagents: new Map(),
  } as Omit<Agent, "opening"> as Agent;
  const live = () => ctx.agents.get(id) === agent;
  // Status can arrive while the session is still opening; it's kept, and
  // pushed with the servers once the session is open.
  const onMcpStatus = async (snapshot: McpStatusSnapshot) => {
    if (!live()) return;
    agent.mcpStatus = new Map(snapshot.servers.map((m) => [m.name, m.status]));
    const push = !!agent.session && isShown(ctx, agent);
    await rememberSignIns(ctx, snapshot);
    if (push) await pushMcpServers(ctx);
  };
  // A closed session's tool calls can't be answered any more.
  const onApproval = (ask: ApprovalAsk) =>
    live() ? askApproval(ctx, agent, ask) : ask.answer(false);
  ctx.agents.set(id, agent);
  pushProjects(ctx);
  agent.opening = inWorkspace(ctx, agent, (workdir) =>
    ctx.openSession(cwd, workdir, id, onMcpStatus, onApproval),
  )
    .then((s) => {
      agent.session = s;
      agent.running = s.isStreaming;
      agent.title = firstTitle(s.messages);
      agent.subagents = subagentsIn(s.messages);
      pushProjects(ctx);
      agent.unsubscribe = s.subscribe((event) => follow(ctx, agent, event));
      return s;
    })
    .catch((error: unknown) => {
      if (live()) ctx.agents.delete(id);
      throw error;
    });
  return agent;
}

// A session that fails to open takes its new worktree with it.
async function inWorkspace(
  ctx: HostContext,
  agent: Agent,
  open: (workdir: string) => Promise<Session>,
) {
  const ws = await ctx.workspaces.open(agent.cwd, agent.id);
  agent.workdir = ws.dir;
  agent.ready = ws.ready;
  try {
    return await open(ws.dir);
  } catch (error) {
    await ctx.workspaces.close(agent.cwd, agent.id).catch(() => {});
    throw error;
  }
}

// Only the shown conversation's events reach the app; the rest keep running unseen.
function follow(ctx: HostContext, agent: Agent, event: SessionEvent) {
  if (isShown(ctx, agent)) {
    ctx.send({
      type: "session_event",
      session: agent.id,
      event: toWireEvent(event),
    });
  }
  const subagentsChanged = followSubagents(agent, event);
  if (trackRun(agent, event) || subagentsChanged) pushProjects(ctx);
  if (event.type === "message_start") delivered(agent, event.message);
  // The first message names the conversation; pi stores it only afterwards.
  const first = event.type === "message_start" && !agent.title;
  if (first && event.message.role === "user") {
    agent.title = titleOf(event.message);
    pushProjects(ctx);
  }
  if (event.type === "agent_settled") settle(ctx, agent);
}

function settle(ctx: HostContext, agent: Agent) {
  if (!agent.session?.pendingMessageCount) agent.queuedImages.clear();
  if (!agent.reloadWhenSettled) return;
  agent.reloadWhenSettled = false;
  agent.session?.reload().catch(reportTo(ctx, agent));
}

/** Ends conversation `id`, or all of the folder's, denying their waiting tool calls. */
export async function close(ctx: HostContext, cwd: string, id?: string) {
  const closing = [...ctx.agents.values()].filter(
    (a) => a.cwd === cwd && (id === undefined || a.id === id),
  );
  await Promise.all(closing.map((a) => end(ctx, a)));
}

async function end(ctx: HostContext, agent: Agent) {
  ctx.agents.delete(agent.id);
  denyAll(ctx, agent);
  pushProjects(ctx);
  const s = await agent.opening.catch(() => null);
  if (!s) return;
  agent.unsubscribe();
  // dispose() alone leaves extensions running (MCP server processes).
  await s.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
  s.dispose();
  // Its work stays saved with the conversation; see worktrees.ts.
  await ctx.workspaces.close(agent.cwd, agent.id).catch(() => {});
}

/** Ends every conversation, as the app quits. */
export async function closeAll(ctx: HostContext) {
  await Promise.all([...ctx.agents.values()].map((a) => end(ctx, a)));
}

// pi's prompt() resolves when the whole run ends; the app follows the run
// through events, so only a failure is reported here.
/** Sends a prompt to the shown conversation, or `session`; a failure goes to `onError` if given. */
export async function prompt(
  ctx: HostContext,
  text: string,
  images?: ImageContent[],
  session?: string,
  onError?: (error: unknown) => void,
  queue: QueueKind = "steer",
) {
  const agent = target(ctx, session);
  const s = await current(ctx, session);
  await agent!.ready;
  // Writing instead of answering declines what waits; the message says what to do instead.
  denyAll(ctx, agent!);
  if (s.isStreaming) rememberImages(agent!, text, images);
  const options = {
    ...(s.isStreaming && { streamingBehavior: queue }),
    ...(images?.length ? { images } : {}),
  };
  s.prompt(text, options).catch(onError ?? reportTo(ctx, agent!));
}

/** Shows a run's failure, if its conversation is the one shown. */
function reportTo(ctx: HostContext, agent: Agent) {
  return (error: unknown) => {
    if (isShown(ctx, agent)) {
      ctx.send({
        type: "session_error",
        session: agent.id,
        error: describeError(error),
      });
    }
  };
}
