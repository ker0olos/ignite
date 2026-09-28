import {
  PROVIDERS,
  type HostMessage,
  type HostRequest,
} from "../shared/hostProtocol.ts";
import {
  current,
  shown,
  type HostContext,
  type OpenSession,
  type SessionStore,
  type Runtime,
  type LocalLogins,
  type McpCatalogSource,
} from "./hostTypes.ts";
import type { McpStore } from "./mcpConfig.ts";
import { status, statusWithin, login } from "./hostAuth.ts";
import {
  sessionState,
  setModel,
  open,
  clear,
  close,
  list,
  prompt,
} from "./hostSession.ts";
import { mcpServers, changeMcp } from "./hostMcp.ts";
import { mcpCatalog, addPreset, importServers } from "./hostMcpCatalog.ts";
import { signIn, signOut } from "./hostMcpSignIn.ts";
import { describeError } from "./wire.ts";
import { memoryStatus } from "./cmem.ts";
import { answerApproval, denyAll } from "./hostApproval.ts";
import { setTrust } from "./hostTrust.ts";
import { appUpdate, appVersion } from "./appUpdate.ts";
import { fileDiff } from "./gitReview.ts";
import type { TrustStore } from "./trust.ts";

type IdRequest = Extract<HostRequest, { id: number }>;
type Handler<K extends IdRequest["type"]> = (
  ctx: HostContext,
  request: Extract<IdRequest, { type: K }>,
) => unknown;

const handlers: { [K in IdRequest["type"]]: Handler<K> } = {
  status: (ctx) => Promise.all(PROVIDERS.map((id) => statusWithin(ctx, id))),
  login: (ctx, r) => login(ctx, r.provider, r.method, r.apiKey),
  cancel_login: (ctx) => {
    ctx.activeLogin?.abort();
    return undefined;
  },
  logout: async (ctx, r) => {
    // Signing out would sign the user out of Claude Code itself.
    if (r.provider === "claude-code") {
      throw new Error("Sign out of Claude Code in Claude Code.");
    }
    await ctx.runtime.logout(r.provider);
    return status(ctx, r.provider);
  },
  open_session: (ctx, r) => open(ctx, r.cwd, r.session),
  new_session: (ctx, r) => open(ctx, r.cwd, ctx.sessions.create()),
  close_session: (ctx, r) => close(ctx, r.cwd, r.session),
  clear_session: (ctx) => clear(ctx),
  list_sessions: (ctx, r) => list(ctx, r.cwd),
  session_state: (ctx) => sessionState(ctx),
  set_model: (ctx, r) => setModel(ctx, r.provider, r.modelId),
  set_thinking_level: async (ctx, r) => {
    (await current(ctx)).setThinkingLevel(r.level, { persist: true });
    return sessionState(ctx);
  },
  prompt: async (ctx, r) => {
    await prompt(ctx, r.text, r.images);
    return undefined;
  },
  abort: async (ctx) => {
    const agent = shown(ctx);
    const s = await current(ctx);
    if (agent) denyAll(ctx, agent);
    await s.abort();
    return undefined;
  },
  mcp_list: (ctx) => mcpServers(ctx),
  mcp_save: (ctx, r) =>
    changeMcp(ctx, () => ctx.mcpStore.save(r.name, r.config, r.previousName), [
      r.name,
    ]),
  mcp_remove: (ctx, r) =>
    changeMcp(ctx, async () => {
      await signOut(ctx, r.name);
      await ctx.mcpStore.remove(r.name);
    }),
  mcp_set_enabled: (ctx, r) =>
    changeMcp(ctx, () => ctx.mcpStore.setEnabled(r.name, r.enabled)),
  mcp_sign_in: (ctx, r) => signIn(ctx, r.name),
  mcp_catalog: (ctx, r) => mcpCatalog(ctx, r.cwd),
  mcp_add_preset: (ctx, r) => addPreset(ctx, r.preset),
  mcp_import: (ctx, r) => importServers(ctx, r.source, r.names, r.cwd),
  memory_status: (_ctx, r) => memoryStatus(r.cwd),
  // The MCP extension reads the setting on (re)load, like mcp.json.
  memory_changed: async (ctx) => {
    await changeMcp(ctx, async () => {});
    return undefined;
  },
  set_trust: (ctx, r) => setTrust(ctx, r.cwd, r.trusted),
  git_diff: (_ctx, r) => fileDiff(r.repo, r.range, r.path),
  app_version: () => appVersion(),
  app_update: () => appUpdate(),
};

/**
 * Handles the app's requests against pi's ModelRuntime. One sign-in runs at a
 * time; its prompts are forwarded to the app and answered by id.
 */
export function createHost(
  runtime: Runtime,
  send: (m: HostMessage) => void,
  openSession: OpenSession,
  sessions: SessionStore,
  local: LocalLogins,
  mcpStore: McpStore,
  catalog: McpCatalogSource,
  trust: TrustStore,
  keepAwake: HostContext["keepAwake"] = async () => {},
) {
  const ctx: HostContext = {
    runtime,
    send,
    openSession,
    sessions,
    local,
    mcpStore,
    catalog,
    trust,
    activeLogin: null,
    agents: new Map(),
    shown: null,
    lastShown: new Map(),
    pendingSignOuts: new Set(),
    checking: new Set(),
    prompts: new Map(),
    nextPromptId: 1,
    keepAwake,
  };

  /** Handles one request from the app; never throws. */
  async function handle(request: HostRequest): Promise<void> {
    if (request.type === "prompt_answer") {
      ctx.prompts.get(request.promptId)?.resolve(request.value);
      return;
    }
    if (request.type === "prompt_cancel") {
      ctx.prompts.get(request.promptId)?.reject(new Error("Cancelled"));
      return;
    }
    if (request.type === "approval_answer") {
      answerApproval(
        ctx,
        request.toolCallId,
        request.approved,
        request.answers,
      );
      return;
    }
    try {
      const run = handlers[request.type] as Handler<IdRequest["type"]>;
      const data = await run(ctx, request as never);
      send({ type: "response", id: request.id, ok: true, data });
    } catch (error) {
      send({
        type: "response",
        id: request.id,
        ok: false,
        error: describeError(error),
      });
    }
  }

  return { handle };
}
