import type {
  ModelInfo,
  SessionState,
  OpenedSession,
} from "../shared/hostProtocol.ts";
import type { ImageContent, SessionEvent } from "../shared/agentTypes.ts";
import {
  current,
  type HostContext,
  type McpStatusSnapshot,
  type Project,
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

/**
 * Shows a folder, starting its session (an empty one if `fresh`) unless it's
 * already open, and returns its state.
 */
export async function open(
  ctx: HostContext,
  cwd: string,
  fresh = false,
): Promise<OpenedSession> {
  if (fresh) await close(ctx, cwd);
  ctx.cwd = cwd;
  ctx.checking.clear();
  const project = ctx.projects.get(cwd) ?? start(ctx, cwd, fresh);
  const s = await project.opening;
  // ponytail: kept in memory; a sidecar restart before a folder opens drops them.
  for (const name of [...ctx.pendingSignOuts]) {
    ctx.pendingSignOuts.delete(name);
    await signOut(ctx, name);
  }
  // Servers now have a status, even before the adapter reports any.
  if (ctx.cwd === cwd) await pushMcpServers(ctx);
  return {
    ...(await sessionState(ctx, s)),
    trust: ctx.trust.get(cwd),
    messages: s.messages,
    running: s.isStreaming,
    ...(s.modelWarning && { modelWarning: s.modelWarning }),
    approvals: [...project.approvals.values()].map((ask) => ask.request),
  };
}

function start(ctx: HostContext, cwd: string, fresh: boolean): Project {
  const project = {
    session: null,
    running: false,
    unsubscribe: () => {},
    mcpStatus: new Map(),
    reloadWhenSettled: false,
    approvals: new Map(),
  } as Omit<Project, "opening"> as Project;
  const live = () => ctx.projects.get(cwd) === project;
  // Status can arrive while the session is still opening; it's kept, and
  // pushed with the servers once the session is open.
  const onMcpStatus = async (snapshot: McpStatusSnapshot) => {
    if (!live()) return;
    project.mcpStatus = new Map(
      snapshot.servers.map((m) => [m.name, m.status]),
    );
    const push = !!project.session && ctx.cwd === cwd;
    await rememberSignIns(ctx, snapshot);
    if (push) await pushMcpServers(ctx);
  };
  // A closed session's tool calls can't be answered any more.
  const onApproval = (ask: ApprovalAsk) =>
    live() ? askApproval(ctx, cwd, project, ask) : ask.answer(false);
  ctx.projects.set(cwd, project);
  pushProjects(ctx);
  project.opening = ctx
    .openSession(cwd, onMcpStatus, onApproval, fresh)
    .then((s) => {
      project.session = s;
      project.running = s.isStreaming;
      project.unsubscribe = s.subscribe((event) =>
        follow(ctx, cwd, project, event),
      );
      return s;
    })
    .catch((error: unknown) => {
      if (live()) ctx.projects.delete(cwd);
      throw error;
    });
  return project;
}

// Only the shown folder's events reach the app; the rest keep running unseen.
function follow(
  ctx: HostContext,
  cwd: string,
  project: Project,
  event: SessionEvent,
) {
  const shown = ctx.projects.get(cwd) === project && ctx.cwd === cwd;
  if (shown) ctx.send({ type: "session_event", event: toWireEvent(event) });
  if (event.type === "agent_start" || event.type === "agent_settled") {
    project.running = event.type === "agent_start";
    pushProjects(ctx);
  }
  if (event.type === "agent_settled" && project.reloadWhenSettled) {
    project.reloadWhenSettled = false;
    project.session?.reload().catch((error: unknown) => {
      if (ctx.cwd === cwd) {
        ctx.send({ type: "session_error", error: describeError(error) });
      }
    });
  }
}

/** Ends a folder's session, denying its waiting tool calls. */
export async function close(ctx: HostContext, cwd: string) {
  const project = ctx.projects.get(cwd);
  if (!project) return;
  ctx.projects.delete(cwd);
  denyAll(ctx, project);
  pushProjects(ctx);
  const s = await project.opening.catch(() => null);
  if (!s) return;
  project.unsubscribe();
  // dispose() alone leaves extensions running (MCP server processes).
  await s.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
  s.dispose();
}

// pi's prompt() resolves when the whole run ends; the app follows the run
// through events, so only a failure is reported here.
/** Sends a prompt to the open session. */
export async function prompt(
  ctx: HostContext,
  text: string,
  images?: ImageContent[],
) {
  const cwd = ctx.cwd;
  const s = await current(ctx);
  // A message sent mid-run steers the agent rather than waiting for the end.
  const options = {
    ...(s.isStreaming && { streamingBehavior: "steer" as const }),
    ...(images?.length ? { images } : {}),
  };
  s.prompt(text, options).catch((error: unknown) => {
    if (ctx.cwd === cwd) {
      ctx.send({ type: "session_error", error: describeError(error) });
    }
  });
}
