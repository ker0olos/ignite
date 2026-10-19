import type {
  ModelInfo,
  SessionState,
  OpenedSession,
} from "../shared/hostProtocol.ts";
import type { ImageContent } from "../shared/agentTypes.ts";
import type { QueueKind } from "../shared/queue.ts";
import {
  current,
  isShown,
  reopened,
  target,
  type Agent,
  type HostContext,
  type McpStatusSnapshot,
  type Session,
} from "./hostTypes.ts";
import type { ApprovalAsk } from "./approvalAsk.ts";
import { rememberSignIns, pushMcpServers } from "./hostMcp.ts";
import { askApproval, denyAll } from "./hostApproval.ts";
import { claudeLoggedIn } from "./hostAuth.ts";
import { subagentsIn } from "./hostChildren.ts";
import { firstTitle } from "../shared/conversations.ts";
import { pushProjects, refuseWhileForked } from "./hostProjects.ts";
import { INTERRUPTED, prepareResume } from "./hostResume.ts";
import { follow, reportTo } from "./hostFollow.ts";
import { forkOf } from "./forks.ts";
import { withEntryIds } from "./hostCheckpoint.ts";
import { hand, takeTurn } from "./hostSend.ts";
import { releaseWorkspace } from "./hostTerminal.ts";
import { commandReason } from "./wire.ts";

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

/**
 * Shows one of a folder's conversations, starting its session unless it's
 * already open, and returns its state. Without `id`, the one `reopened`
 * finds, or null: showing a folder never starts a conversation.
 */
export async function open(
  ctx: HostContext,
  cwd: string,
  id = reopened(ctx, cwd),
  known?: string,
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
  const resume = started ? null : prepareResume(s);
  if (resume) {
    agent.resume = resume;
    const failed = async (error: unknown) => {
      await resume.cancel(INTERRUPTED);
      throw error;
    };
    setTimeout(() =>
      agent.ready.then(resume.begin, failed).catch(reportTo(ctx, agent)),
    );
  }
  // Servers now have a status, even before the adapter reports any.
  if (isShown(ctx, agent)) await pushMcpServers(ctx);
  const state = await sessionState(ctx, s);
  // Taken after the last await, so no event falls between them and the app's.
  const messages = messagesFor(s, !!agent.followed, known === id);
  agent.followed = true;
  return {
    ...state,
    session: id,
    workdir: agent.workdir,
    trust: ctx.trust.get(cwd),
    ...messages,
    running: s.isStreaming || !!agent.routing,
    ...(agent.routing && { routing: agent.routing.message }),
    ...(s.modelWarning && { modelWarning: s.modelWarning }),
    approvals: [...agent.approvals.values()].map((ask) => ask.request),
    toolRuns: [...agent.toolRuns.values()],
    queue: {
      steering: [...s.getSteeringMessages()],
      followUp: [...s.getFollowUpMessages()],
    },
  };
}

/**
 * The conversation so far, unless the app follows it and says so (`known`):
 * it has applied every event since, and a long one is megabytes.
 */
function messagesFor(s: Session, followed: boolean, known: boolean) {
  if (followed && known) return {};
  // pi lists a message once it ends; the one being written follows.
  return {
    messages: withEntryIds(s.sessionManager, [
      ...s.messages,
      ...[s.agent.state.streamingMessage ?? []].flat(),
    ]),
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
    toolRuns: new Map(),
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
      agent.title = s.sessionManager.getSessionName() ?? firstTitle(s.messages);
      agent.subagents = subagentsIn(s.messages);
      agent.forkOf = forkOf(s.sessionManager);
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
  const making = ctx.workspaces.open(agent.cwd, agent.id);
  agent.placed = making.then(
    (ws) => void Object.assign(agent, { workdir: ws.dir, ready: ws.ready }),
    () => {},
  );
  const ws = await making.catch((error: unknown) => {
    throw new Error(
      `Couldn't set up this conversation's worktree: ${commandReason(error)}`,
      { cause: error },
    );
  });
  try {
    return await open(ws.dir);
  } catch (error) {
    await releaseWorkspace(ctx, agent);
    throw error;
  }
}

/** Ends conversation `id`, or all of the folder's, denying their waiting tool calls. */
export async function close(ctx: HostContext, cwd: string, id?: string) {
  const closing = [...ctx.agents.values()].filter(
    (a) => a.cwd === cwd && (id === undefined || a.id === id),
  );
  await Promise.all(closing.map((a) => end(ctx, a)));
}

async function end(ctx: HostContext, agent: Agent, quitting = false) {
  ctx.agents.delete(agent.id);
  agent.closed = true;
  // Quitting leaves them waiting, to ask again on the next launch (hostResume.ts).
  if (!quitting) denyAll(ctx, agent);
  agent.routing?.controller.abort();
  pushProjects(ctx);
  const s = await agent.opening.catch(() => null);
  if (!s) return;
  agent.unsubscribe();
  // dispose() alone leaves extensions running (MCP server processes).
  await s.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
  s.dispose();
  // Its work stays saved with the conversation; see worktrees.ts.
  await releaseWorkspace(ctx, agent, quitting);
}

/** Ends every conversation, as the app quits. */
export async function closeAll(ctx: HostContext) {
  await Promise.all([...ctx.agents.values()].map((a) => end(ctx, a, true)));
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
  refuseWhileForked(ctx, session);
  const s = await current(ctx, session);
  const turn = takeTurn(agent!);
  await turn.before;
  let handed = false;
  try {
    const out = { text, images, queue, onError };
    handed = await hand(ctx, agent!, s, out, turn.done);
  } finally {
    if (!handed) turn.done();
  }
}
