/**
 * The pi host sidecar, loaded by main.ts. The app talks to it over
 * stdin/stdout using shared/hostProtocol.ts. Stdout carries protocol messages
 * only; logs go to stderr. Closing stdin ends the process.
 */
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AgentSession,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  type ExtensionUIContext,
  initTheme,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { createClaudeCode } from "./claudeCode.ts";
import { codexBackend, withCodexLogin } from "./credentials.ts";
import { createHost } from "./host.ts";
import type { McpStatusSnapshot, Runtime, Session } from "./hostTypes.ts";
import { createLineSplitter } from "./lines.ts";
import { findImports, PRESETS } from "./mcpCatalog.ts";
import { createMcpStore, MCP_AUTH_URL_EVENT } from "./mcpConfig.ts";
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import { createTrustStore } from "./trust.ts";

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

const send = (message: HostMessage) =>
  process.stdout.write(JSON.stringify(message) + "\n");

// Extensions only report problems (a failed MCP sign-in) through a bound UI.
// This one declines every prompt and passes errors on to the app.
const headlessUI = {
  select: async () => undefined,
  confirm: async () => false,
  input: async () => undefined,
  notify: (message: string, type?: "info" | "warning" | "error") => {
    process.stderr.write(`pi-host: ${type ?? "info"}: ${message}\n`);
    if (type === "error") send({ type: "extension_error", message });
  },
  onTerminalInput: () => () => {},
  setStatus: () => {},
  setWorkingMessage: () => {},
  setWorkingVisible: () => {},
  setWorkingIndicator: () => {},
  setHiddenThinkingLabel: () => {},
  setWidget: () => {},
  setFooter: () => {},
  setHeader: () => {},
  setTitle: () => {},
  custom: async () => undefined,
  pasteToEditor: () => {},
  setEditorText: () => {},
  getEditorText: () => "",
  editor: async () => undefined,
  addAutocompleteProvider: () => {},
  setEditorComponent: () => {},
  getEditorComponent: () => undefined,
  // Styling helpers (fg, bold, ...) return the text as is; nothing is drawn.
  theme: new Proxy(
    {},
    {
      get:
        () =>
        (...args: unknown[]) =>
          args.at(-1),
    },
  ),
  getAllThemes: () => [],
  getTheme: () => undefined,
  setTheme: () => ({ success: false, error: "No UI" }),
  getToolsExpanded: () => false,
  setToolsExpanded: () => {},
} as unknown as ExtensionUIContext;

// Runs Claude through the user's own Claude Code (Agent SDK), which Anthropic
// bills to the Claude plan; pi's direct Claude sign-in draws extra usage.
// Resolved, not joined, so they're found (or overridden) from a modded copy.
const sibling = (name: string) => fileURLToPath(import.meta.resolve(name));
const claudeBridge = sibling("pi-claude-bridge/src/index.ts");
// pi-mcp-adapter, reading only agentDir/mcp.json.
const mcpExtension = sibling("./mcpExtension.ts");
const cmemExtension = sibling("./cmemExtension.ts");
// Last, so it judges tool calls as the other extensions left them.
const approvalExtension = sibling("./approvalExtension.ts");
const trust = createTrustStore(agentDir);
// pi-mcp-adapter's status channel (MCP_STATUS_EVENT in its types.ts).
const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";

// Extensions style status text with pi's TUI theme even without a terminal;
// pi-mcp-adapter throws on reload if none is set.
initTheme("dark");

function sameModel(
  a: { provider: string; id: string } | undefined,
  b: { provider: string; id: string },
): boolean {
  return !!a && a.provider === b.provider && a.id === b.id;
}

const MODEL_WAIT_MS = 10_000;

// Read before createAgentSession, which saves its own fallback into an empty
// session and would hide this choice.
function savedModel(
  sessionManager: SessionManager,
  settingsManager: SettingsManager,
) {
  const saved = sessionManager.buildSessionContext().model;
  const provider = saved?.provider ?? settingsManager.getDefaultProvider();
  const id = saved?.modelId ?? settingsManager.getDefaultModel();
  return provider && id ? { provider, id } : undefined;
}

async function whenAvailable(provider: string, id: string) {
  const deadline = Date.now() + MODEL_WAIT_MS;
  for (;;) {
    const model = runtime.getModel(provider, id);
    if (model && (await runtime.checkAuth(provider))) return model;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// pi picks the model before extensions register their providers, so a saved
// claude-bridge model isn't found yet; wait for it, then pick it again.
/** Returns a warning when the saved model never became available. */
async function reselectModel(
  wanted: { provider: string; id: string } | undefined,
  session: AgentSession,
): Promise<string | undefined> {
  if (!wanted || sameModel(session.model, wanted)) return;
  const model = await whenAvailable(wanted.provider, wanted.id);
  if (model) {
    await session.setModel(model);
    return;
  }
  const using = session.model ? `; using ${session.model.name}` : "";
  return `${wanted.id} isn't available${using}.`;
}

// Continues the folder's last conversation, saved under agentDir/sessions.
// Clearing deletes all of them, or reopening would pick up an older one.
async function sessionFor(cwd: string, fresh: boolean) {
  if (!fresh) return SessionManager.continueRecent(cwd);
  for (const { path } of await SessionManager.list(cwd)) {
    await rm(path, { force: true });
  }
  return SessionManager.create(cwd);
}

async function openSession(
  cwd: string,
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
  onApproval: (ask: ApprovalAsk) => void,
  fresh: boolean,
): Promise<Session> {
  // pi-claude-bridge runs Claude Code in process.cwd() (pi doesn't pass the
  // session's), which would load this app's CLAUDE.md instead of the folder's.
  // Each window has its own sidecar with one session, so this is safe.
  process.chdir(cwd);
  // Project .pi/ resources load only once the user trusts the folder.
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    projectTrusted: trust.get(cwd) === "trusted",
  });
  // One bus per session, so a closed session's listeners go with it.
  const eventBus = createEventBus();
  eventBus.on(MCP_AUTH_URL_EVENT, (url) =>
    send({ type: "auth_event", event: { type: "auth_url", url: String(url) } }),
  );
  eventBus.on(MCP_STATUS_EVENT, (data) =>
    onMcpStatus(data as McpStatusSnapshot),
  );
  eventBus.on(APPROVAL_EVENT, (data) => onApproval(data as ApprovalAsk));
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    eventBus,
    additionalExtensionPaths: [
      claudeBridge,
      mcpExtension,
      cmemExtension,
      approvalExtension,
    ],
  });
  await resourceLoader.reload();
  const sessionManager = await sessionFor(cwd, fresh);
  const wanted = savedModel(sessionManager, settingsManager);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: runtime,
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
  return Object.assign(session as unknown as Session, { modelWarning });
}

// pi's types are pi-ai's; they match Runtime and Session structurally.
const host = createHost(
  runtime as unknown as Runtime,
  send,
  openSession,
  { claudeCode: createClaudeCode(), usesCodexLogin: logins.usesCodex },
  createMcpStore(join(agentDir, "mcp.json")),
  { presets: PRESETS, findImports: (cwd) => findImports(homedir(), cwd) },
  trust,
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
// Finish answering what was already asked, then exit.
process.stdin.on("end", async () => {
  lines.end();
  await Promise.allSettled(inFlight);
  process.exit(0);
});

send({ type: "ready" });
log("ready");
