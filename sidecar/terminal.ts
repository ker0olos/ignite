/** The user's terminals: a login shell in a PTY each, mirrored into a headless xterm the folder's agents read. */
import { existsSync } from "node:fs";
import { userInfo } from "node:os";
import { sep } from "node:path";
import xterm from "@xterm/headless";
import serialize from "@xterm/addon-serialize";
import type { IPty } from "node-pty";
import type {
  TerminalInfo,
  TerminalMessage,
  TerminalSnapshot,
} from "../shared/terminal.ts";
import { APP_NAME } from "../src/lib/app.ts";
import {
  commandLine,
  foregroundGroup,
  exitOf,
  headlessTerminal,
  killTree,
  spawnPty,
  terminalEnv,
} from "./ptyShell.ts";

type Terminal = {
  info: Omit<TerminalInfo, "name">;
  pty: IPty;
  screen: InstanceType<typeof xterm.Terminal>;
  serializer: InstanceType<typeof serialize.SerializeAddon>;
  /** The PTY's listeners, dropped before the screen is disposed. */
  listeners: { dispose(): void }[];
  /** Where its output and exit go. */
  send: (m: TerminalMessage) => void;
  /** Lines the shell has printed, counted by line feeds; what an agent has seen is measured against it. */
  lines: number;
  /** Looking at what runs in the foreground after output; `again` when more came meanwhile. */
  watch: {
    timer?: NodeJS.Timeout;
    busy: boolean;
    again: boolean;
    group?: number;
  };
};

type Registry = {
  all: Map<string, Terminal>;
  next: number;
  /** Per conversation, per terminal: `lines` when it last saw it. */
  seen: Map<string, Map<string, number>>;
};

// On globalThis: extensions load afresh per session, and read the same terminals.
const shared = globalThis as { [key: symbol]: Registry };
const KEY = Symbol.for(`${APP_NAME}.terminals`);
const registry = (shared[KEY] ??= { all: new Map(), next: 1, seen: new Map() });

const SCROLLBACK = 5000;
/** The most an agent is handed of one terminal unasked, before its next run. */
const UNSEEN_LINES = 200;
const MAX_CHARS = 50_000;
const COMMAND_CHECK_MS = 500;

function shell(): { file: string; args: string[] } {
  if (process.platform === "win32") return { file: "powershell.exe", args: [] };
  return {
    file: process.env.SHELL || userInfo().shell || "/bin/zsh",
    args: ["-l"],
  };
}

function find(id: string): Terminal {
  const found = registry.all.get(id);
  if (!found) throw new Error(`No terminal ${id}.`);
  return found;
}

/** Starts the user's shell in `dir` (else `cwd`), listed under folder `cwd`; its output and exit go to `send`. */
export function openTerminal(
  cwd: string,
  cols: number,
  rows: number,
  send: (m: TerminalMessage) => void,
  dir = cwd,
): TerminalInfo {
  // A closed conversation's worktree is gone; its folder stands in.
  if (!existsSync(dir)) dir = cwd;
  const { file, args } = shell();
  const env = terminalEnv();
  const pty = spawnPty(file, args, { cwd: dir, env, cols, rows });
  const screen = headlessTerminal({ cols, rows, scrollback: SCROLLBACK });
  const serializer = new serialize.SerializeAddon();
  screen.loadAddon(serializer);
  // Never shaped like a name (t1), which shifts as terminals close.
  const id = `term-${registry.next++}`;
  const t: Terminal = {
    info: { terminal: id, cwd, ...(dir !== cwd && { dir }), running: true },
    pty,
    screen,
    serializer,
    listeners: [],
    send,
    lines: 0,
    watch: { busy: false, again: false },
  };
  // Full-screen programs (vim, less, top) redraw on the alternate screen; only shell output counts.
  screen.onLineFeed(() => {
    if (screen.buffer.active.type === "normal") t.lines++;
  });
  t.listeners.push(
    pty.onData((data) => {
      screen.write(data);
      send({ type: "terminal_data", terminal: id, data });
      watchCommand(t, send);
    }),
    pty.onExit(({ exitCode }) => {
      t.info = { ...t.info, running: false, exitCode, command: undefined };
      send({ type: "terminal_exit", terminal: id, exitCode });
    }),
  );
  registry.all.set(id, t);
  return terminalsIn(cwd).find((info) => info.terminal === id)!;
}

// A command starting echoes the Enter and one ending prints the prompt, so output is when it changes.
function watchCommand(t: Terminal, send: (m: TerminalMessage) => void) {
  const { watch } = t;
  if (watch.busy) {
    watch.again = true;
    return;
  }
  watch.busy = true;
  watch.timer = setTimeout(() => void checkCommand(t, send), COMMAND_CHECK_MS);
}

async function checkCommand(t: Terminal, send: (m: TerminalMessage) => void) {
  const { watch } = t;
  watch.again = false;
  const group = await foregroundGroup(t.pty.pid);
  // Same group, same command: a pipeline runs on after its leader (named) exits.
  const command =
    group === watch.group
      ? t.info.command
      : group
        ? await commandLine(group)
        : undefined;
  watch.group = group;
  watch.busy = false;
  const { terminal, running } = t.info;
  if (registry.all.get(terminal) !== t || !running) return;
  if (command !== t.info.command) {
    t.info = { ...t.info, command };
    send({ type: "terminal_command", terminal, command });
  }
  if (watch.again) watchCommand(t, send);
}

export function writeTerminal(id: string, data: string) {
  const t = find(id);
  if (t.info.running) t.pty.write(data);
}

/** The terminals whose shell started in `dir` or a folder in it. */
export const terminalsStartedIn = (dir: string) =>
  [...registry.all]
    .filter(([, t]) => t.info.dir === dir || t.info.dir?.startsWith(dir + sep))
    .map(([id]) => id);

/** Ends terminal `id` and what it started, telling the app; resolves once it exited, or after a few seconds. */
export async function endTerminal(id: string) {
  const t = find(id);
  const exited = t.info.running ? exitOf(t.pty, 3000) : undefined;
  if (t.info.running) killTree(t.pty.pid);
  closeTerminal(id);
  t.send({ type: "terminal_exit", terminal: id, exitCode: -1 });
  await exited;
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  const t = find(id);
  if (t.info.running) t.pty.resize(cols, rows);
  t.screen.resize(cols, rows);
}

export function closeTerminal(id: string) {
  const t = registry.all.get(id);
  if (!t) return;
  t.listeners.forEach((l) => l.dispose());
  clearTimeout(t.watch.timer);
  if (t.info.running) t.pty.kill();
  t.screen.dispose();
  registry.all.delete(id);
  for (const seen of registry.seen.values()) seen.delete(id);
}

/** Closes the terminal unless a command runs in it; true if it's gone. Windows can't tell, so keeps it. */
export async function closeIdleTerminal(id: string): Promise<boolean> {
  const t = registry.all.get(id);
  if (!t) return true;
  if (t.info.running) {
    if (process.platform === "win32") return false;
    if (await foregroundGroup(t.pty.pid)) return false;
  }
  closeTerminal(id);
  return true;
}

/** The folder's terminals, oldest first, named by their place: closing one renames those after it. */
export function terminalsIn(cwd: string): TerminalInfo[] {
  return [...registry.all.values()]
    .filter((t) => t.info.cwd === cwd)
    .map((t, i) => ({ ...t.info, name: `t${i + 1}` }));
}

/**
 * A terminal's screen and scrollback as escape codes, to restore a view, and
 * its exit once it has. It holds everything already sent as terminal_data,
 * since the screen finishes parsing first.
 */
export async function terminalSnapshot(id: string): Promise<TerminalSnapshot> {
  const t = find(id);
  await new Promise<void>((resolve) => t.screen.write("", resolve));
  const { running, exitCode } = t.info;
  return {
    screen: t.serializer.serialize(),
    ...(!running && exitCode !== undefined && { exitCode }),
  };
}

/** The shell's text up to the cursor, wrapped rows joined, trailing blanks dropped. */
function screenLines(id: string): string[] {
  const buffer = find(id).screen.buffer.normal;
  const lines: string[] = [];
  const end = buffer.baseY + buffer.cursorY;
  for (let row = 0; row <= end; row++) {
    const line = buffer.getLine(row);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  while (lines.length && !lines.at(-1)!.trim()) lines.pop();
  return lines;
}

const header = (info: TerminalInfo) =>
  `Terminal ${info.name} in ${info.dir ?? info.cwd}` +
  (info.running ? "" : ` (exited ${info.exitCode})`);

function tail(lines: string[], count: number): string {
  const text = lines.slice(-count).join("\n");
  return text.length > MAX_CHARS ? `…${text.slice(-MAX_CHARS)}` : text;
}

function markSeen(session: string, id: string) {
  const seen = registry.seen.get(session) ?? new Map<string, number>();
  seen.set(id, find(id).lines);
  registry.seen.set(session, seen);
}

/** The end of the folder's terminals (or one of them), as an agent reads it; marks them seen. */
export function readTerminals(
  session: string,
  cwd: string,
  lines: number,
  only?: string,
): string {
  const picked = terminalsIn(cwd).filter(
    (t) => !only || t.name === only || t.terminal === only,
  );
  if (!picked.length) {
    return only
      ? `No terminal ${only} in ${cwd}.`
      : `The user has no terminal open in ${cwd}.`;
  }
  return picked
    .map((info) => {
      markSeen(session, info.terminal);
      return `${header(info)}:\n${tail(screenLines(info.terminal), lines)}`;
    })
    .join("\n\n");
}

/** What the folder's terminals printed since `session` last saw them, or null; marks them seen. */
export function unseenTerminals(session: string, cwd: string): string | null {
  const seen = registry.seen.get(session);
  const parts: string[] = [];
  for (const info of terminalsIn(cwd)) {
    const t = find(info.terminal);
    const fresh = t.lines - (seen?.get(info.terminal) ?? 0);
    if (fresh <= 0) continue;
    // +1 for the line the cursor is on: the prompt, or a command still running.
    const text = tail(
      screenLines(info.terminal),
      Math.min(fresh, UNSEEN_LINES) + 1,
    );
    markSeen(session, info.terminal);
    if (text.trim()) parts.push(`${header(info)}:\n${text}`);
  }
  return parts.length ? parts.join("\n\n") : null;
}
