import {
  PROVIDERS,
  type HostMessage,
  type HostRequest,
} from "../shared/hostProtocol.ts";
import {
  current,
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
  closeAll,
  prompt,
} from "./hostSession.ts";
import { worktreeHandlers } from "./hostTerminal.ts";
import { userPickedModel } from "./hostRoute.ts";
import { closeConversation, fork } from "./hostFork.ts";
import { rewind } from "./hostRewind.ts";
import { lessonHandlers } from "./hostReflect.ts";
import { mcpServers, changeMcp, changeSkills } from "./hostMcp.ts";
import { mcpCatalog, addPreset, importServers } from "./hostMcpCatalog.ts";
import { signIn, signOut } from "./hostMcpSignIn.ts";
import { describeError } from "./wire.ts";
import { memoryStatus } from "./memory.ts";
import { answered } from "./hostAnswers.ts";
import { setTrust } from "./hostTrust.ts";
import { compact, stop, unqueue } from "./hostQueue.ts";
import { appRestart, appUpdate, appVersion } from "./appUpdate.ts";
import { fileDiff } from "./gitReview.ts";
import {
  conversationGitStatus,
  discardFile,
  repoDetails,
} from "./gitStatus.ts";
import { backgroundOutput, stopBackground } from "./backgroundBash.ts";
import { watchBackground } from "./hostWait.ts";
import { skipWait } from "./skipWait.ts";
import { messagesOf, newId, sessionDetails } from "./sessionStore.ts";
import { listFiles } from "./fileIndex.ts";
import { createSearch } from "./search.ts";
import type { TrustStore } from "./trust.ts";
import type { SkillStore } from "./skillStore.ts";
import { deleteTask, finishTask, resumeTask, startTask } from "./hostTasks.ts";
import type { TaskStore } from "./taskStore.ts";
import { deleteTodo, readTodos } from "./todoFile.ts";
import {
  closeIdleTerminal,
  closeTerminal,
  resizeTerminal,
  terminalSnapshot,
  terminalsIn,
  writeTerminal,
} from "./terminal.ts";

type IdRequest = Extract<HostRequest, { id: number }>;

type Handler<K extends IdRequest["type"]> = (
  ctx: HostContext,
  request: Extract<IdRequest, { type: K }>,
) => unknown;

const handlers: { [K in IdRequest["type"]]: Handler<K> } = {
  status: (ctx) => Promise.all(PROVIDERS.map((id) => statusWithin(ctx, id))),
  login: (ctx, r) => login(ctx, r.provider, r.method, r.apiKey),
  cancel_login: (ctx) => void ctx.activeLogin?.abort(),
  logout: async (ctx, r) => {
    // Signing out would sign the user out of Claude Code itself.
    if (r.provider === "claude-code") {
      throw new Error("Sign out of Claude Code in Claude Code.");
    }
    await ctx.runtime.logout(r.provider);
    return status(ctx, r.provider);
  },
  open_session: (ctx, r) => open(ctx, r.cwd, r.session, r.known),
  new_session: async (ctx, r) =>
    r.fork
      ? fork(ctx, r.cwd, r.fork.session, r.fork.task)
      : open(ctx, r.cwd, newId(ctx, r.session)),
  // The user dismissing a conversation is done with its task.
  close_session: async (ctx, r) => {
    await closeConversation(ctx, r.cwd, r.session);
    if (r.session) await finishTask(ctx, r.cwd, r.session);
  },
  read_session: (ctx, r) => messagesOf(ctx, r.cwd, r.session, r.tail),
  command_search: (ctx, r) => ctx.search(r),
  session_details: (ctx, r) => sessionDetails(ctx, r.cwd, r.session),
  session_state: async (ctx, r) =>
    sessionState(ctx, await current(ctx, r.session)),
  // ponytail: the draft is shared by every folder, so a folder's own .pi skills only show once its conversation starts.
  draft_state: async (ctx, r) => ({
    ...(await sessionState(
      ctx,
      await ctx.draft({ model: r.model, level: r.level }),
    )),
    skills: ctx.skills
      .sessionSkills({ skills: [] })
      .skills.map(({ name, description }) => ({ name, description })),
  }),
  set_model: (ctx, r) => {
    userPickedModel(ctx, r.session);
    return setModel(ctx, r.provider, r.modelId, r.session);
  },
  set_thinking_level: async (ctx, r) => {
    const s = await current(ctx, r.session);
    s.setThinkingLevel(r.level, { persist: true });
    return sessionState(ctx, s);
  },
  prompt: async (ctx, r) => {
    await prompt(ctx, r.text, r.images, r.session, undefined, r.queue);
    return undefined;
  },
  rewind: (ctx, r) => rewind(ctx, r.session, r.entryId, r.text, r.images),
  abort: (ctx, r) => stop(ctx, r.session),
  compact: (ctx, r) => compact(ctx, r.session, r.instructions),
  unqueue: (ctx, r) => unqueue(ctx, r),
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
  ...lessonHandlers,
  ...worktreeHandlers,
  memory_status: (_ctx, r) =>
    memoryStatus(r.cwd, { query: r.query, kind: r.kind }),
  // The memory extension reads the setting on (re)load, like mcp.json.
  memory_changed: (ctx) => changeMcp(ctx, async () => {}).then(() => {}),
  set_trust: (ctx, r) => setTrust(ctx, r.cwd, r.trusted),
  git_diff: (_ctx, r) => fileDiff(r.repo, r.range, r.path),
  git_status: async (ctx, r) => {
    const repos = await conversationGitStatus(ctx, r.session);
    const cwd = ctx.agents.get(r.session)?.cwd;
    if (cwd && repos?.some((g) => g.pr?.state === "MERGED"))
      await finishTask(ctx, cwd, r.session);
    return repos;
  },
  git_repo_details: (_ctx, r) => repoDetails(r.repo),
  git_discard: (_ctx, r) => discardFile(r.repo, r.path),
  background_output: (_ctx, r) => backgroundOutput(r.pid, r.session),
  background_stop: (_ctx, r) => stopBackground(r.pid, r.session),
  skip_wait: (_ctx, r) => skipWait(r.toolCallId),
  tasks_list: (ctx, r) => ctx.tasks.list(r.cwd),
  todo_list: (_ctx, r) => readTodos(r.cwd),
  todo_delete: (_ctx, r) => deleteTodo(r.cwd, r.item),
  task_save: (ctx, r) => ctx.tasks.save(r.cwd, r.task),
  task_edit: (ctx, r) => ctx.tasks.edit(r.cwd, r.taskId, r.patch),
  task_delete: (ctx, r) => deleteTask(ctx, r.cwd, r.taskId),
  task_start: (ctx, r) => startTask(ctx, r.cwd, r.taskId, r.interactive),
  task_resume: (ctx, r) => resumeTask(ctx, r.cwd, r.taskId, r.text),
  terminal_input: (_ctx, r) => writeTerminal(r.terminal, r.data),
  terminal_resize: (_ctx, r) => resizeTerminal(r.terminal, r.cols, r.rows),
  terminal_close: (_ctx, r) => closeTerminal(r.terminal),
  terminal_close_idle: (_ctx, r) => closeIdleTerminal(r.terminal),
  terminal_list: (_ctx, r) => terminalsIn(r.cwd),
  terminal_snapshot: (_ctx, r) => terminalSnapshot(r.terminal),
  app_version: () => appVersion(),
  app_update: (ctx) =>
    appUpdate({
      installing: () => ctx.send({ type: "app_update_installing" }),
    }),
  app_restart: () => appRestart(),
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
  tasks: TaskStore,
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
    tasks,
    starting: new Set(),
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
    if (answered(ctx, request)) return;
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

  const unwatch = watchBackground(ctx);
  const shutdown = async () => {
    unwatch();
    await closeAll(ctx);
  };
  return { handle, shutdown };
}
