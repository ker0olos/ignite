/** Bash commands left running in the background (dev servers, watchers), each tied to its conversation. */
import { createWriteStream, mkdirSync } from "node:fs";
import { open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BashOperations } from "@earendil-works/pi-coding-agent";
import type { BackgroundOutput } from "../shared/agentStatus.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { startShell } from "./ptyBash.ts";
import { killTree } from "./ptyShell.ts";

/** A background command, still running or ended; `session` is its conversation's id. */
export type Background = {
  pid: number;
  session: string;
  command: string;
  /** Its output as text, for the agent to read. */
  log: string;
  /** Its output as the terminal got it (colors, redraws), for the app's view. */
  raw: string;
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

// It stays running until it exits; one that ignores SIGTERM gets SIGKILL.
function endTree(pid: number, running: () => boolean, after = KILL_AFTER_MS) {
  killTree(pid);
  setTimeout(() => running() && killTree(pid, "SIGKILL"), after).unref();
}

const end = (b: Background, after?: number) =>
  endTree(b.pid, () => b.running, after);

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
  const file = await open(found.raw);
  try {
    const { size } = await file.stat();
    const length = Math.min(size, OUTPUT_BYTES);
    const { buffer } = await file.read({
      buffer: Buffer.alloc(length),
      position: size - length,
    });
    // Cut at a line, never inside a character or an escape sequence.
    const start = size > length ? buffer.indexOf(0x0a) + 1 : 0;
    const { command, running, exitCode } = found;
    return {
      command,
      running,
      ...(exitCode !== undefined && { exitCode }),
      output: buffer.subarray(start).toString("utf8"),
      truncated: size > length,
    };
  } finally {
    await file.close();
  }
}

/**
 * pi's shell operations, except the command keeps running after the call:
 * output goes to the caller for `wait` ms (or until it exits), and all of it
 * to a text log for the agent and a raw one for the app. `started` gets it once
 * it's left running; `command` is how the user wrote it, before the sandbox
 * wrapped it.
 */
export function backgroundOperations(
  { session, command }: { session: string; command: string },
  started: (b: Background) => void,
  wait = STARTUP_MS,
): BashOperations {
  return {
    exec: (wrapped, cwd, { onData, signal, env }) =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error("aborted"));
        const dir = join(tmpdir(), `${APP_NAME}-background`);
        mkdirSync(dir, { recursive: true });
        let entry: Background | undefined;
        let settled = false;
        let shell: ReturnType<typeof startShell>;
        try {
          shell = startShell(
            wrapped,
            cwd,
            env,
            (text) => {
              textOut.write(text);
              if (!settled) onData(Buffer.from(text));
            },
            (data) => rawOut.write(data),
          );
        } catch (error) {
          reject(error);
          return;
        }
        const { pid, done } = shell;
        const name = join(dir, `${pid}-${Date.now()}`);
        const log = `${name}.log`;
        const raw = `${name}.raw.log`;
        const textOut = createWriteStream(log);
        const rawOut = createWriteStream(raw);
        let exited = false;
        const abort = () => endTree(pid, () => !exited);
        signal?.addEventListener("abort", abort, { once: true });
        const settle = (finish: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          finish();
        };
        // Stopped while starting: it settles once it has exited, never as started.
        const timer = setTimeout(
          () =>
            !signal?.aborted &&
            settle(() => {
              const pending = shell.pending();
              if (pending.trim()) onData(Buffer.from(pending));
              entry = { pid, session, command, log, raw, running: true };
              all.set(keyOf(session, pid), entry);
              changed();
              started(entry);
              resolve({ exitCode: 0 });
            }),
          wait,
        );
        void done.then(({ exitCode, signal: killed }) => {
          exited = true;
          textOut.end();
          rawOut.end();
          if (entry) {
            entry.running = false;
            entry.exitCode = killed ? undefined : exitCode;
            changed();
          }
          settle(() =>
            signal?.aborted
              ? reject(new Error("aborted"))
              : resolve({ exitCode }),
          );
        });
      }),
  };
}
