/** Bash commands left running in the background (dev servers, watchers), each tied to its conversation. */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getShellConfig,
  type BashOperations,
} from "@earendil-works/pi-coding-agent";
import type { BackgroundOutput } from "../shared/agentStatus.ts";
import { APP_NAME } from "../src/lib/app.ts";

/** A background command, still running or ended; `session` is its conversation's id. */
export type Background = {
  pid: number;
  session: string;
  command: string;
  log: string;
  running: boolean;
  exitCode?: number;
};

type Registry = { all: Map<string, Background>; listeners: Set<() => void> };

// On globalThis: extensions load afresh per session and on every reload,
// and a reload must not lose track of what's running.
const shared = globalThis as { [key: symbol]: Registry };
const KEY = Symbol.for(`${APP_NAME}.background`);
const { all, listeners } = (shared[KEY] ??= registry());

// Keyed by conversation too: the OS reuses pids, and ended ones stay listed.
const keyOf = (session: string, pid: number) => `${session}:${pid}`;

// The sidecar exits when the app closes its stdin; a signal would skip the
// exit handler, so it kills them first, then dies as the signal would.
function registry(): Registry {
  const killAll = () => {
    for (const b of all.values()) if (b.running) killTree(b.pid, "SIGKILL");
  };
  process.once("exit", killAll);
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.once(signal, () => {
      killAll();
      process.kill(process.pid, signal);
    });
  }
  return { all: new Map(), listeners: new Set() };
}

const changed = () => listeners.forEach((listener) => listener());

/** Calls `listener` whenever a background command starts or ends; returns the unsubscribe. */
export function onBackgroundChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** How long a background command runs before the call returns. */
export const STARTUP_MS = 5000;

/** The most of a log the app is sent at once. */
const OUTPUT_BYTES = 64 * 1024;

/** How long a stopped command has to exit before it's killed outright. */
const KILL_AFTER_MS = 3000;

/** Signals `pid` and everything it started. */
function killTree(pid: number, signal: "SIGTERM" | "SIGKILL" = "SIGTERM") {
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"]);
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    // Already gone.
  }
}

// It stays running until it exits; one that ignores SIGTERM gets SIGKILL.
function end(b: Background, after = KILL_AFTER_MS) {
  killTree(b.pid);
  setTimeout(() => b.running && killTree(b.pid, "SIGKILL"), after).unref();
}

/** Stops conversation `session`'s background command `pid`; false if it has none running. */
export function stopBackground(
  pid: number,
  session: string,
  after = KILL_AFTER_MS,
): boolean {
  const found = all.get(keyOf(session, pid));
  if (!found?.running) return false;
  end(found, after);
  return true;
}

/** Stops conversation `session`'s background commands and forgets them, as it ends. */
export function forgetBackground(session: string) {
  for (const b of backgroundOf(session)) {
    if (b.running) end(b);
    all.delete(keyOf(session, b.pid));
  }
  changed();
}

/** Conversation `session`'s background commands, running or ended, oldest first. */
export function backgroundOf(session: string): Background[] {
  return [...all.values()].filter((b) => b.session === session);
}

/** The end of a background command's output, for the app to show. */
export async function backgroundOutput(
  pid: number,
  session: string,
): Promise<BackgroundOutput> {
  const found = all.get(keyOf(session, pid));
  if (!found) {
    throw new Error(`No background command ${pid} in this conversation.`);
  }
  const file = await open(found.log);
  try {
    const { size } = await file.stat();
    const length = Math.min(size, OUTPUT_BYTES);
    const { buffer } = await file.read({
      buffer: Buffer.alloc(length),
      position: size - length,
    });
    const { command, running, exitCode } = found;
    return {
      command,
      running,
      ...(exitCode !== undefined && { exitCode }),
      output: buffer.toString("utf8"),
      truncated: size > length,
    };
  } finally {
    await file.close();
  }
}

function spawnShell(command: string, cwd: string, env?: NodeJS.ProcessEnv) {
  const shell = getShellConfig();
  const stdin = shell.commandTransport === "stdin";
  const child = spawn(
    shell.shell,
    stdin ? shell.args : [...shell.args, command],
    {
      cwd,
      detached: process.platform !== "win32",
      env,
      stdio: [stdin ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  if (stdin) child.stdin?.end(command);
  const dir = join(tmpdir(), `${APP_NAME}-background`);
  mkdirSync(dir, { recursive: true });
  return { child, log: join(dir, `${child.pid}-${Date.now()}.log`) };
}

/**
 * pi's shell operations, except the command keeps running after the call:
 * output goes to the caller for `wait` ms (or until it exits), then only to
 * a log file. `started` gets it once it's left running; `command` is how the
 * user wrote it, before the sandbox wrapped it.
 */
export function backgroundOperations(
  { session, command }: { session: string; command: string },
  started: (b: Background) => void,
  wait = STARTUP_MS,
): BashOperations {
  return {
    exec: (wrapped, cwd, { onData, signal, env }) =>
      new Promise((resolve, reject) => {
        const { child, log } = spawnShell(wrapped, cwd, env);
        const out = createWriteStream(log);
        let entry: Background | undefined;
        let settled = false;
        const forward = (chunk: Buffer) => {
          out.write(chunk);
          if (!settled) onData(chunk);
        };
        child.stdout?.on("data", forward);
        child.stderr?.on("data", forward);
        const abort = () => child.pid && killTree(child.pid);
        signal?.addEventListener("abort", abort, { once: true });
        const settle = (done: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          done();
        };
        const timer = setTimeout(
          () =>
            settle(() => {
              entry = { pid: child.pid!, session, command, log, running: true };
              all.set(keyOf(session, entry.pid), entry);
              child.unref();
              changed();
              started(entry);
              resolve({ exitCode: 0 });
            }),
          wait,
        );
        child.once("error", (error) => settle(() => reject(error)));
        child.once("close", (code) => {
          out.end();
          if (entry) {
            entry.running = false;
            entry.exitCode = code ?? undefined;
            changed();
          }
          settle(() =>
            signal?.aborted
              ? reject(new Error("aborted"))
              : resolve({ exitCode: code ?? 1 }),
          );
        });
      }),
  };
}
