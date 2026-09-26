/**
 * The pi host sidecar. The app starts it with `node sidecar/main.ts` (Node
 * runs the TypeScript directly) and talks to it over stdin/stdout using
 * shared/hostProtocol.ts. Stdout carries protocol messages only; logs go to
 * stderr. Closing stdin ends the process.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { createHost, type Runtime, type Session } from "./host.ts";
import { createLineSplitter } from "./lines.ts";

// pi's files for this app live beside our settings, never in the pi CLI's
// own ~/.pi/agent, so signing in or out here doesn't affect it.
const agentDir = join(homedir(), `.${APP_NAME}`, "pi");
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_TELEMETRY = "0";

const runtime = await ModelRuntime.create({
  authPath: join(agentDir, "auth.json"),
  modelsPath: null,
});

const send = (message: HostMessage) =>
  process.stdout.write(JSON.stringify(message) + "\n");

async function openSession(cwd: string): Promise<Session> {
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime: runtime,
    // ponytail: in memory and project untrusted (no project extensions) until
    // prompting and a trust prompt exist.
    sessionManager: SessionManager.inMemory(cwd),
    settingsManager: SettingsManager.create(cwd, agentDir, {
      projectTrusted: false,
    }),
  });
  return session as unknown as Session;
}

// pi's types are pi-ai's; they match Runtime and Session structurally.
const host = createHost(runtime as unknown as Runtime, send, openSession);

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
