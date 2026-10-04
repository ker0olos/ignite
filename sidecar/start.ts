/**
 * The pi host sidecar, loaded by main.ts. The app talks to it over
 * stdin/stdout using shared/hostProtocol.ts. Stdout carries protocol messages
 * only; logs go to stderr. Closing stdin ends the process.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  initTheme,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { createClaudeCode } from "./claudeCode.ts";
import { codexBackend, withCodexLogin } from "./credentials.ts";
import { createHeadlessUI } from "./headlessUI.ts";
import { createHost } from "./host.ts";
import type { McpStatusSnapshot, Runtime, Session } from "./hostTypes.ts";
import { sessionFor, sessions } from "./sessionStore.ts";
import { createWorkspaces } from "./worktrees.ts";
import { createDraft } from "./draftSession.ts";
import { MCP_STATUS_EVENT, mcpSessionOpener } from "./mcpSession.ts";
import {
  defaultTools,
  freshExtensions,
  reselectModel,
  runtimeFor,
  savedModel,
} from "./sessionRuntime.ts";
import { createLineSplitter } from "./lines.ts";
import { findImports } from "./mcpCatalog.ts";
import { PRESETS } from "./mcpPresets.ts";
import { createMcpStore, MCP_AUTH_URL_EVENT } from "./mcpConfig.ts";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import { SUBAGENT_EVENT, type SubagentAsk } from "./subagentExtension.ts";
import { createKeepAwake } from "./keepAwake.ts";
import { createTrustStore } from "./trust.ts";
import { createSkillStore } from "./skillStore.ts";
import { createRemote } from "./remote.ts";
import { taskAnswerer, taskStoreIn } from "./hostTasks.ts";
import { TASK_EVENT } from "./taskExtension.ts";

// pi's files for this app live beside our settings, never in the pi CLI's
// own ~/.pi/agent, so signing in or out here doesn't affect it.
const log = (message: string) =>
  process.stderr.write(
    `pi-host: ${message} (${Math.round(process.uptime() * 1000)}ms)\n`,
  );
log(`loaded, Node ${process.version}`);

const agentDir = join(homedir(), `.${APP_NAME}`, "pi");
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_TELEMETRY = "0";

// ponytail: pi doesn't export its auth.json store, so it's loaded by path;
// recheck on pi upgrades (the version is pinned).
const { AuthStorage } = await import(
  new URL(
    "./core/auth-storage.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
);
const logins = withCodexLogin(
  AuthStorage.create(join(agentDir, "auth.json")),
  AuthStorage.fromStorage(codexBackend(join(homedir(), ".codex", "auth.json"))),
);

const runtime = await ModelRuntime.create({
  credentials: logins.store,
  modelsPath: null,
});
log("model runtime created");

// Stdout carries protocol messages only; extensions' console output (e.g.
// pi-mcp-adapter's "Removed credentials") goes to stderr with the rest.
console.log = console.info = console.error;

const toApp = (message: unknown) =>
  process.stdout.write(JSON.stringify(message) + "\n");
// Browsers with remote access share this sidecar; see remote.ts.
const remote = createRemote((r) => host.handle(r), toApp, log);
const send = (message: HostMessage) =>
  remote.toBrowsers(message) || toApp(message);

const headlessUI = createHeadlessUI(send);

// Runs Claude through the user's own Claude Code (Agent SDK), which Anthropic
// bills to the Claude plan; pi's direct Claude sign-in draws extra usage.
// Resolved, not joined, so they're found (or overridden) from a modded copy.
const sibling = (name: string) => fileURLToPath(import.meta.resolve(name));
const claudeBridge = sibling("pi-claude-bridge/src/index.ts");
// pi-mcp-adapter, reading only agentDir/mcp.json.
const mcpExtension = sibling("./mcpExtension.ts");
const subagentExtension = sibling("./subagentExtension.ts");
const taskExtension = sibling("./taskExtension.ts");
const exploring = sibling("./exploreExtension.ts");
// Last, so it judges tool calls as the other extensions left them.
const approvalExtension = sibling("./approvalExtension.ts");
const trust = createTrustStore(agentDir);
const skills = createSkillStore(agentDir, homedir());
const skillsOverride = skills.sessionSkills;
const tasks = taskStoreIn(join(agentDir, "..", "tasks"), send);
const onAuthUrl = (url: string) =>
  send({ type: "auth_event", event: { type: "auth_url", url } });

// Extensions style status text with pi's TUI theme even without a terminal;
// pi-mcp-adapter throws on reload if none is set.
initTheme("dark");

// pi works in `workdir` (the agent's worktree); trust and saved
// conversations stay the folder's.
async function openSession(
  folder: string,
  cwd: string,
  id: string,
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
  onApproval: (ask: ApprovalAsk) => void,
): Promise<Session> {
  // Claude calls get the session's cwd (runtimeFor), but pi-claude-bridge
  // still reads process.cwd() for its project config and AskClaude.
  process.chdir(cwd);
  // Project .pi/ resources load only once the user trusts the folder.
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    projectTrusted: trust.get(folder) === "trusted",
  });
  // One bus per session, so a closed session's listeners go with it.
  const eventBus = createEventBus();
  eventBus.on(MCP_AUTH_URL_EVENT, (url) => onAuthUrl(String(url)));
  eventBus.on(MCP_STATUS_EVENT, (data) =>
    onMcpStatus(data as McpStatusSnapshot),
  );
  eventBus.on(APPROVAL_EVENT, (data) => onApproval(data as ApprovalAsk));
  eventBus.on(TASK_EVENT, taskAnswerer(tasks, folder, id));
  eventBus.on(SUBAGENT_EVENT, (data) => {
    const ask = data as SubagentAsk;
    ask.reply(openSubagent(folder, cwd, ask, eventBus));
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    eventBus,
    additionalExtensionPaths: [
      claudeBridge,
      mcpExtension,
      sibling("./cmemExtension.ts"),
      sibling("./askExtension.ts"),
      subagentExtension,
      sibling("./gitExtension.ts"),
      sibling("./worktreeExtension.ts"),
      sibling("./chromeExtension.ts"),
      sibling("./adbExtension.ts"),
      sibling("./imageExtension.ts"),
      sibling("./htmlExtension.ts"),
      sibling("./bashExtension.ts"),
      sibling("./terminalExtension.ts"),
      exploring,
      taskExtension,
      approvalExtension,
    ],
    skillsOverride,
  });
  freshExtensions();
  await resourceLoader.reload();
  // After the reload, which rereads settings from disk and drops overrides.
  settingsManager.applyOverrides({ defaultTools });
  const sessionManager = sessionFor(folder, cwd, id);
  const wanted = savedModel(sessionManager, settingsManager);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: await runtimeFor(logins.store, cwd),
    sessionManager,
    settingsManager,
    resourceLoader,
  });
  // Starts extensions (session_start), as pi's own modes do; the error
  // listener also makes a reload start them again.
  await session.bindExtensions({
    uiContext: headlessUI,
    onError: ({ extensionPath, event, error }) =>
      process.stderr.write(`pi-host: ${extensionPath} (${event}): ${error}\n`),
  });
  const modelWarning = await reselectModel(wanted, session);
  if (modelWarning) log(modelWarning);
  const reload = session.reload.bind(session);
  session.reload = () => {
    freshExtensions();
    return reload();
  };
  return Object.assign(session as unknown as Session, { modelWarning });
}

// In memory, with its own settings so choosing its model never becomes the
// default. Its tool calls reach the app through the main session's bus.
// ponytail: no MCP servers or cmem in subagents; add their extensions if needed.
async function openSubagent(
  folder: string,
  cwd: string,
  { model, effort, tools, prompt }: SubagentAsk,
  eventBus: ReturnType<typeof createEventBus>,
) {
  const settingsManager = SettingsManager.inMemory(
    { defaultTools },
    { projectTrusted: trust.get(folder) === "trusted" },
  );
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    eventBus,
    additionalExtensionPaths: [claudeBridge, exploring, approvalExtension],
    skillsOverride,
    appendSystemPromptOverride: (base) => [...base, prompt],
  });
  freshExtensions();
  await resourceLoader.reload();
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: await runtimeFor(logins.store, cwd),
    model,
    thinkingLevel: effort,
    tools,
    sessionManager: SessionManager.inMemory(cwd),
    settingsManager,
    resourceLoader,
  });
  await session.bindExtensions({ uiContext: headlessUI });
  return session;
}

const workspaces = createWorkspaces();
const base = { agentDir, credentials: logins.store, uiContext: headlessUI };
const draft = createDraft({ ...base, claudeBridge });
// Worktrees left by an app that crashed or was killed; this one's are locked to it.
void workspaces.sweep();

// pi's types are pi-ai's; they match Runtime and Session structurally.
const host = createHost(
  runtime as unknown as Runtime,
  send,
  openSession,
  sessions,
  workspaces,
  draft,
  { claudeCode: createClaudeCode(), usesCodexLogin: logins.usesCodex },
  createMcpStore(join(agentDir, "mcp.json")),
  mcpSessionOpener({ ...base, mcpExtension, onAuthUrl }),
  { presets: PRESETS, findImports: (cwd) => findImports(homedir(), cwd) },
  trust,
  skills,
  tasks,
  createKeepAwake(),
);

const inFlight = new Set<Promise<void>>();

const lines = createLineSplitter((line) => {
  let request: HostRequest;
  try {
    request = JSON.parse(line);
  } catch {
    process.stderr.write(`pi-host: ignoring a line that isn't JSON\n`);
    return;
  }
  if (remote.fromApp(request)) return;
  // Slow requests are logged, so a stuck one shows up in the app's terminal.
  const started = Date.now();
  const stuck = setTimeout(
    () => log(`${request.type} still running after 15s`),
    15_000,
  );
  const handled = host.handle(request).finally(() => {
    clearTimeout(stuck);
    const took = Date.now() - started;
    if (took > 1000) log(`${request.type} took ${took}ms`);
  });
  inFlight.add(handled);
  void handled.finally(() => inFlight.delete(handled));
});

process.stdin.on("data", lines.push);
// Finish answering what was already asked, save and remove the worktrees, then exit.
process.stdin.on("end", async () => {
  lines.end();
  await Promise.allSettled(inFlight);
  await host.shutdown();
  process.exit(0);
});

send({ type: "ready" });
// Opened now, so a new conversation's model menu is ready when first shown.
void draft({}).catch(() => {});
log("ready");
