import type {
  ModelInfo,
  SessionState,
  OpenedSession,
} from "../shared/hostProtocol.ts";
import type { ImageContent } from "../shared/agentTypes.ts";
import {
  current,
  type HostContext,
  type McpStatusSnapshot,
} from "./hostTypes.ts";
import { describeError, toWireEvent } from "./wire.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import { rememberSignIns, pushMcpServers } from "./hostMcp.ts";
import { signOut } from "./hostMcpSignIn.ts";
import { askApproval, denyAll } from "./hostApproval.ts";

const info = ({ provider, id, name }: ModelInfo): ModelInfo => ({
  provider,
  id,
  name,
});

// Everything comes from pi: the connected providers' models, and the levels
// the session's model supports (pi clamps the level itself).
/** Returns the session's models and effort levels. */
export async function sessionState(ctx: HostContext): Promise<SessionState> {
  const s = current(ctx);
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
  const s = current(ctx);
  const model = (await ctx.runtime.getAvailable()).find(
    (m) => m.provider === provider && m.id === modelId,
  );
  if (!model) throw new Error(`${modelId} isn't available.`);
  // Persisted so the next session starts with the same choice.
  await s.setModel(model, { persist: true });
  return sessionState(ctx);
}

/** Opens a folder's session (an empty one if `fresh`) and returns its state. */
export async function open(
  ctx: HostContext,
  cwd: string,
  fresh = false,
): Promise<OpenedSession> {
  const opened = ++ctx.opens;
  const previous = ctx.session;
  ctx.unsubscribe();
  ctx.session = null;
  ctx.cwd = null;
  ctx.reloadWhenSettled = false;
  denyAll(ctx);
  ctx.mcpStatus = new Map();
  ctx.checking.clear();
  if (previous) {
    // dispose() alone leaves extensions running (MCP server processes).
    await previous.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    });
    previous.dispose();
  }
  // Status can arrive while the session is still opening; it's kept, and
  // pushed with the servers once the session is open.
  const onMcpStatus = async (snapshot: McpStatusSnapshot) => {
    if (opened !== ctx.opens) return;
    ctx.mcpStatus = new Map(snapshot.servers.map((m) => [m.name, m.status]));
    // While the session is still opening, open() pushes once it's done.
    const push = !!ctx.session;
    await rememberSignIns(ctx, snapshot);
    if (push) await pushMcpServers(ctx);
  };
  // A replaced session's tool calls can't be answered any more.
  const onApproval = (ask: ApprovalAsk) =>
    opened === ctx.opens ? askApproval(ctx, ask) : ask.answer(false);
  const s = await ctx.openSession(cwd, onMcpStatus, onApproval, fresh);
  ctx.session = s;
  ctx.cwd = cwd;
  // ponytail: kept in memory; a sidecar restart before a folder opens drops them.
  for (const name of [...ctx.pendingSignOuts]) {
    ctx.pendingSignOuts.delete(name);
    await signOut(ctx, name);
  }
  ctx.unsubscribe = s.subscribe((event) => {
    ctx.send({ type: "session_event", event: toWireEvent(event) });
    if (event.type === "agent_settled" && ctx.reloadWhenSettled) {
      ctx.reloadWhenSettled = false;
      s.reload().catch((error: unknown) =>
        ctx.send({ type: "session_error", error: describeError(error) }),
      );
    }
  });
  // Servers now have a status, even before the adapter reports any.
  await pushMcpServers(ctx);
  return {
    ...(await sessionState(ctx)),
    trust: ctx.trust.get(cwd),
    messages: s.messages,
    running: s.isStreaming,
    ...(s.modelWarning && { modelWarning: s.modelWarning }),
  };
}

// pi's prompt() resolves when the whole run ends; the app follows the run
// through events, so only a failure is reported here.
/** Sends a prompt to the open session. */
export function prompt(
  ctx: HostContext,
  text: string,
  images?: ImageContent[],
) {
  const s = current(ctx);
  // A message sent mid-run steers the agent rather than waiting for the end.
  const options = {
    ...(s.isStreaming && { streamingBehavior: "steer" as const }),
    ...(images?.length ? { images } : {}),
  };
  s.prompt(text, options).catch((error: unknown) =>
    ctx.send({ type: "session_error", error: describeError(error) }),
  );
}
