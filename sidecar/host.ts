import {
  PROVIDERS,
  type HostMessage,
  type HostRequest,
} from "../shared/hostProtocol.ts";
import {
  current,
  target,
  type HostContext,
  type OpenSession,
  type OpenMcpSession,
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
  close,
  closeAll,
  prompt,
} from "./hostSession.ts";
import { mcpServers, changeMcp, reloadSessions } from "./hostMcp.ts";
import { mcpCatalog, addPreset, importServers } from "./hostMcpCatalog.ts";
import { signIn, signOut } from "./hostMcpSignIn.ts";
import { describeError } from "./wire.ts";
import { memoryStatus } from "./cmem.ts";
import { answerApproval, denyAll } from "./hostApproval.ts";
import { setTrust } from "./hostTrust.ts";
import { appUpdate, appVersion } from "./appUpdate.ts";
import { fileDiff } from "./gitReview.ts";
import { describeSession } from "./describeSession.ts";
import { listFiles } from "./fileIndex.ts";
import { createSearch } from "./search.ts";
import type { TrustStore } from "./trust.ts";
import type { SkillStore } from "./skillStore.ts";

type IdRequest = Extract<HostRequest, { id: number }>;

// Sessions read skills on (re)load.
const changeSkills = async (ctx: HostContext, edit: () => Promise<void>) => {
  await edit();
  await reloadSessions(ctx);
  return ctx.skills.list();
};

// A running conversation's own messages are newer than its file's.
const messagesOf = async (ctx: HostContext, cwd: string, session: string) =>
  ctx.agents.get(session)?.session?.messages ?? ctx.sessions.read(cwd, session);
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
  read_session: (ctx, r) => messagesOf(ctx, r.cwd, r.session),
  command_search: (ctx, r) => ctx.search(r),
  session_details: async (ctx, r) => ({
    ...describeSession(await messagesOf(ctx, r.cwd, r.session), r.cwd),
    ...(await ctx.sessions.extras(r.cwd, r.session)),
  }),
  session_state: async (ctx, r) =>
    sessionState(ctx, await current(ctx, r.session)),
  draft_state: async (ctx, r) =>
    sessionState(ctx, await ctx.draft({ model: r.model, level: r.level })),
  set_model: (ctx, r) => setModel(ctx, r.provider, r.modelId, r.session),
  set_thinking_level: async (ctx, r) => {
    const s = await current(ctx, r.session);
    s.setThinkingLevel(r.level, { persist: true });
    return sessionState(ctx, s);
  },
  prompt: async (ctx, r) => {
    await prompt(ctx, r.text, r.images, r.session);
    return undefined;
  },
  abort: async (ctx, r) => {
    const agent = target(ctx, r.session);
    const s = await current(ctx, r.session);
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
  skills_list: (ctx) => ctx.skills.list(),
  skills_set_enabled: (ctx, r) =>
    changeSkills(ctx, () => ctx.skills.setEnabled(r.skill, r.enabled)),
  skills_remove: (ctx, r) =>
    changeSkills(ctx, () => ctx.skills.remove(r.skill)),
  skills_catalog: (ctx) => ctx.skills.catalog(),
  skills_import: (ctx, r) =>
    changeSkills(ctx, () => ctx.skills.importSkills(r.source, r.names)),
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
  workspaces: HostContext["workspaces"],
  draft: HostContext["draft"],
  local: LocalLogins,
  mcpStore: McpStore,
  openMcpSession: OpenMcpSession,
  catalog: McpCatalogSource,
  trust: TrustStore,
  skills: SkillStore,
  keepAwake: HostContext["keepAwake"] = async () => {},
  search: HostContext["search"] = createSearch(sessions, listFiles),
) {
  const ctx: HostContext = {
    runtime,
    send,
    openSession,
    sessions,
    workspaces,
    draft,
    local,
    mcpStore,
    openMcpSession,
    mcpSession: null,
    mcpStatus: new Map(),
    catalog,
    trust,
    skills,
    activeLogin: null,
    claudeLogin: null,
    agents: new Map(),
    shown: null,
    lastShown: new Map(),
    checking: new Set(),
    prompts: new Map(),
    nextPromptId: 1,
    keepAwake,
    search,
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

  return { handle, shutdown: () => closeAll(ctx) };
}
