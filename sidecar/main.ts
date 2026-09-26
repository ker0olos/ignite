/**
 * The pi host sidecar. The app starts it with `node sidecar/main.ts` (Node
 * runs the TypeScript directly) and talks to it over stdin/stdout using
 * shared/hostProtocol.ts. Stdout carries protocol messages only; logs go to
 * stderr. Closing stdin ends the process.
 */
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { createClaudeCode } from "./claudeCode.ts";
import { codexBackend, withCodexLogin } from "./credentials.ts";
import { createHost, type Runtime, type Session } from "./host.ts";
import { createLineSplitter } from "./lines.ts";

// pi's files for this app live beside our settings, never in the pi CLI's
// own ~/.pi/agent, so signing in or out here doesn't affect it.
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

const send = (message: HostMessage) =>
  process.stdout.write(JSON.stringify(message) + "\n");

// Runs Claude through the user's own Claude Code (Agent SDK), which Anthropic
// bills to the Claude plan; pi's direct Claude sign-in draws extra usage.
const claudeBridge = join(
  dirname(
    createRequire(import.meta.url).resolve("pi-claude-bridge/package.json"),
  ),
  "src/index.ts",
);

async function openSession(cwd: string): Promise<Session> {
  // ponytail: project untrusted (no project extensions) until a trust
  // prompt exists; see .todo.
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    projectTrusted: false,
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalExtensionPaths: [claudeBridge],
  });
  await resourceLoader.reload();
  // Continues the folder's last conversation, saved under agentDir/sessions.
  const sessionManager = SessionManager.continueRecent(cwd);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: runtime,
    sessionManager,
    settingsManager,
    resourceLoader,
  });
  // pi picks the model before extensions register their providers, so a
  // saved claude-bridge model isn't found yet; pick it again now that it is.
  const saved = sessionManager.buildSessionContext().model;
  const provider = saved?.provider ?? settingsManager.getDefaultProvider();
  const id = saved?.modelId ?? settingsManager.getDefaultModel();
  const wanted = provider && id ? runtime.getModel(provider, id) : undefined;
  if (
    wanted &&
    (wanted.provider !== session.model?.provider ||
      wanted.id !== session.model?.id) &&
    (await runtime.checkAuth(wanted.provider))
  ) {
    await session.setModel(wanted);
  }
  return session as unknown as Session;
}

// pi's types are pi-ai's; they match Runtime and Session structurally.
const host = createHost(runtime as unknown as Runtime, send, openSession, {
  claudeCode: createClaudeCode(),
  usesCodexLogin: logins.usesCodex,
});

const inFlight = new Set<Promise<void>>();

const lines = createLineSplitter((line) => {
  let request: HostRequest;
  try {
    request = JSON.parse(line);
  } catch {
    process.stderr.write(`pi-host: ignoring a line that isn't JSON\n`);
    return;
  }
  const handled = host.handle(request);
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
