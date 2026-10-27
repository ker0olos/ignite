import { execFile } from "node:child_process";
import type { EventEmitter } from "node:events";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { APP_NAME } from "../src/lib/app.ts";
import { log } from "./hostLog.ts";

const run = promisify(execFile);

const HANGS_DIR = join(homedir(), `.${APP_NAME}`, "hangs");
const STALL_MS = 10_000;
const TICK_MS = 1000;

/** The app's running WebKit page and GPU processes, from `launchctl print pid/<app>`. */
export function webkitPids(listing: string): number[] {
  const services =
    /^\s*(\d+)\s+\S+\s+com\.apple\.WebKit\.(?:WebContent|GPU)\.\S+$/gm;
  return [...listing.matchAll(services)]
    .map((m) => Number(m[1]))
    .filter((pid) => pid > 0);
}

/** Samples the app and its WebKit processes for 3 seconds each into ~/.ignite/hangs. */
async function sampleApp(appPid = process.ppid, dir = HANGS_DIR) {
  // Orphaned: launchd's services aren't the app's.
  if (appPid === 1) return;
  const { stdout } = await run("launchctl", ["print", `pid/${appPid}`]);
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runs = await Promise.allSettled(
    [appPid, ...webkitPids(stdout)].map((pid) =>
      run("sample", [
        String(pid),
        "3",
        "-file",
        join(dir, `${stamp}-${pid}.txt`),
      ]),
    ),
  );
  const done = runs.filter((r) => r.status === "fulfilled").length;
  log(`the page stopped answering; ${done} samples in ${dir}`);
}

/**
 * Takes the page's heartbeats and, on macOS, samples the app's processes once
 * when a visible page sends none for 10 seconds. Returns the heartbeat handler.
 */
export function createHangWatch(
  sample: () => Promise<void> = () => sampleApp(),
  platform = process.platform,
  input: EventEmitter = process.stdin,
) {
  let last = 0;
  let lastTick = 0;
  let armed = false;
  let timer: NodeJS.Timeout | undefined;
  // The app closed: beats stop while shutdown runs on, which isn't a hang.
  input.once("end", () => (armed = false));
  const tick = () => {
    const now = Date.now();
    // A late tick means the Mac slept: the page didn't hang, it was paused too.
    if (now - lastTick > 3 * TICK_MS) last = now;
    lastTick = now;
    if (!armed || now - last < STALL_MS) return;
    armed = false;
    void sample().catch((e: Error) => log(`hang sample failed: ${e.message}`));
  };
  return (visible: boolean) => {
    if (platform !== "darwin") return;
    last = lastTick = Date.now();
    armed = visible;
    timer ??= setInterval(tick, TICK_MS).unref();
  };
}
