import type {
  ModelInfo,
  SessionState,
  OpenedSession,
} from "../shared/hostProtocol.ts";
import type { ImageContent, SessionEvent } from "../shared/agentTypes.ts";
import {
  current,
  isShown,
  shown,
  type Agent,
  type HostContext,
  type McpStatusSnapshot,
  type Session,
} from "./hostTypes.ts";
import { describeError, toWireEvent } from "./wire.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import { rememberSignIns, pushMcpServers } from "./hostMcp.ts";
import { signOut } from "./hostMcpSignIn.ts";
import { askApproval, denyAll } from "./hostApproval.ts";
import { pushProjects } from "./hostProjects.ts";

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
    ctx.runtime.getAvailable(),
    ctx.local.claudeCode.status(),
  ]);
  // The bridge lists its models whether or not Claude Code is signed in.
  const usable = models.filter(
    (m) => m.provider !== "claude-bridge" || claude.loggedIn,
  );
  return {
    models: usable.map(info),
    model: s.model && info(s.model),
    thinkingLevel: s.thinkingLevel,
    thinkingLevels: s.getAvailableThinkingLevels(),
  };
}

/** Changes the session's model and persists it for future sessions. */
export async function setModel(
  ctx: HostContext,
  provider: string,
  modelId: string,
) {
  const s = await current(ctx);
  const model = (await ctx.runtime.getAvailable()).find(
    (m) => m.provider === provider && m.id === modelId,
  );
  if (!model) throw new Error(`${modelId} isn't available.`);
  // Persisted so the next session starts with the same choice.
  await s.setModel(model, { persist: true });
  return sessionState(ctx);
}

// The last one shown, else another one open, else the most recent saved one.
function reopened(ctx: HostContext, cwd: string): string {
  const last = ctx.lastShown.get(cwd);
  if (last && ctx.agents.has(last)) return last;
  const open = [...ctx.agents.values()].find((a) => a.cwd === cwd);
  return open?.id ?? ctx.sessions.latest(cwd);
}

/**
 * Shows one of a folder's conversations (see `reopened` when `id` is unset),
 * starting its session unless it's already open, and returns its state.
 */
export async function open(
  ctx: HostContext,
  cwd: string,
  id = reopened(ctx, cwd),
): Promise<OpenedSession> {
  ctx.shown = id;
  ctx.lastShown.set(cwd, id);
  ctx.checking.clear();
  const agent = ctx.agents.get(id) ?? start(ctx, cwd, id);
  const s = await agent.opening;
  // ponytail: kept in memory; a sidecar restart before a folder opens drops them.
  for (const name of [...ctx.pendingSignOuts]) {
    ctx.pendingSignOuts.delete(name);
    await signOut(ctx, name);
  }
  // Servers now have a status, even before the adapter reports any.
  if (isShown(ctx, agent)) await pushMcpServers(ctx);
  return {
    ...(await sessionState(ctx, s)),
    session: id,
    trust: ctx.trust.get(cwd),
    messages: s.messages,
    running: s.isStreaming,
    ...(s.modelWarning && { modelWarning: s.modelWarning }),
    approvals: [...agent.approvals.values()].map((ask) => ask.request),
  };
}

/** Ends the shown conversation and shows an empty one in its place; the old one stays saved. */
export async function clear(ctx: HostContext): Promise<OpenedSession> {
  const agent = shown(ctx);
  await current(ctx);
  await end(ctx, agent!);
  return open(ctx, agent!.cwd, ctx.sessions.create());
}

function start(ctx: HostContext, cwd: string, id: string): Agent {
  const agent = {
    id,
    cwd,
    session: null,
    running: false,
    unsubscribe: () => {},
    mcpStatus: new Map(),
    reloadWhenSettled: false,
    approvals: new Map(),
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
  agent.opening = ctx
    .openSession(cwd, id, onMcpStatus, onApproval)
    .then((s) => {
      agent.session = s;
      agent.running = s.isStreaming;
      agent.unsubscribe = s.subscribe((event) => follow(ctx, agent, event));
      return s;
    })
    .catch((error: unknown) => {
      if (live()) ctx.agents.delete(id);
      throw error;
    });
  return agent;
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
  if (event.type === "agent_start" || event.type === "agent_settled") {
    agent.running = event.type === "agent_start";
    pushProjects(ctx);
  }
  if (event.type === "agent_settled" && agent.reloadWhenSettled) {
    agent.reloadWhenSettled = false;
    agent.session?.reload().catch((error: unknown) => {
      if (isShown(ctx, agent)) {
        ctx.send({
          type: "session_error",
          session: agent.id,
          error: describeError(error),
        });
      }
    });
  }
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
}

/** The folder's saved conversations, newest first, marking the open ones. */
export async function list(ctx: HostContext, cwd: string) {
  const saved = await ctx.sessions.list(cwd);
  return saved.map((s) => ({ ...s, open: ctx.agents.has(s.id) }));
}

// pi's prompt() resolves when the whole run ends; the app follows the run
// through events, so only a failure is reported here.
/** Sends a prompt to the shown conversation. */
export async function prompt(
  ctx: HostContext,
  text: string,
  images?: ImageContent[],
) {
  const agent = shown(ctx);
  const s = await current(ctx);
  // A message sent mid-run steers the agent rather than waiting for the end.
  const options = {
    ...(s.isStreaming && { streamingBehavior: "steer" as const }),
    ...(images?.length ? { images } : {}),
  };
  s.prompt(text, options).catch((error: unknown) => {
    if (isShown(ctx, agent!)) {
      ctx.send({
        type: "session_error",
        session: agent!.id,
        error: describeError(error),
      });
    }
  });
}
