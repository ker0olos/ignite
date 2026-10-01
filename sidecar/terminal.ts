/** The user's terminals: a login shell in a PTY each, mirrored into a headless xterm the folder's agents read. */
import { chmodSync } from "node:fs";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import xterm from "@xterm/headless";
import serialize from "@xterm/addon-serialize";
import { spawn, type IPty } from "node-pty";
import type { TerminalInfo, TerminalMessage } from "../shared/terminal.ts";
import { APP_NAME } from "../src/lib/app.ts";

type Terminal = {
  info: TerminalInfo;
  pty: IPty;
  screen: InstanceType<typeof xterm.Terminal>;
  serializer: InstanceType<typeof serialize.SerializeAddon>;
  /** Lines the shell has printed, counted by line feeds; what an agent has seen is measured against it. */
  lines: number;
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

// ponytail: node-pty 1.1's prebuilt spawn-helper ships without its exec bit
// ("posix_spawnp failed"); drop once a release fixes it.
function fixSpawnHelper() {
  if (process.platform === "win32") return;
  const helper = new URL(
    `../prebuilds/${process.platform}-${process.arch}/spawn-helper`,
    import.meta.resolve("node-pty"),
  );
  try {
    chmodSync(fileURLToPath(helper), 0o755);
  } catch {
    // Built from source instead, where it's executable.
  }
}

function shell(): { file: string; args: string[] } {
  if (process.platform === "win32") return { file: "powershell.exe", args: [] };
  return {
    file: process.env.SHELL || userInfo().shell || "/bin/zsh",
    args: ["-l"],
  };
}

/** The sidecar's environment minus what points pi at the app's own files. */
function shellEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("PI_")) env[key] = value;
  }
  return {
    ...env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: APP_NAME,
  };
}

function find(id: string): Terminal {
  const found = registry.all.get(id);
  if (!found) throw new Error(`No terminal ${id}.`);
  return found;
}

/** Starts the user's shell in `cwd`; its output and exit go to `send`. */
export function openTerminal(
  cwd: string,
  cols: number,
  rows: number,
  send: (m: TerminalMessage) => void,
): TerminalInfo {
  fixSpawnHelper();
  const { file, args } = shell();
  const pty = spawn(file, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: shellEnv(),
  });
  const screen = new xterm.Terminal({
    cols,
    rows,
    scrollback: SCROLLBACK,
    allowProposedApi: true,
  });
  const serializer = new serialize.SerializeAddon();
  screen.loadAddon(serializer);
  const id = `t${registry.next++}`;
  const t: Terminal = {
    info: { terminal: id, cwd, running: true },
    pty,
    screen,
    serializer,
    lines: 0,
  };
  // Full-screen programs (vim, less, top) redraw on the alternate screen; only shell output counts.
  screen.onLineFeed(() => {
    if (screen.buffer.active.type === "normal") t.lines++;
  });
  pty.onData((data) => {
    screen.write(data);
    send({ type: "terminal_data", terminal: id, data });
  });
  pty.onExit(({ exitCode }) => {
    t.info = { ...t.info, running: false, exitCode };
    send({ type: "terminal_exit", terminal: id, exitCode });
  });
  registry.all.set(id, t);
  return t.info;
}

export function writeTerminal(id: string, data: string) {
  const t = find(id);
  if (t.info.running) t.pty.write(data);
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  const t = find(id);
  if (t.info.running) t.pty.resize(cols, rows);
  t.screen.resize(cols, rows);
}

export function closeTerminal(id: string) {
  const t = registry.all.get(id);
  if (!t) return;
  if (t.info.running) t.pty.kill();
  t.screen.dispose();
  registry.all.delete(id);
  for (const seen of registry.seen.values()) seen.delete(id);
}

/** The folder's terminals, oldest first. */
export function terminalsIn(cwd: string): TerminalInfo[] {
  return [...registry.all.values()]
    .filter((t) => t.info.cwd === cwd)
    .map((t) => t.info);
}

/** A terminal's screen and scrollback as escape codes, to restore a view. */
export function terminalSnapshot(id: string): string {
  return find(id).serializer.serialize();
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
  `Terminal ${info.terminal} in ${info.cwd}` +
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
  const picked = terminalsIn(cwd).filter((t) => !only || t.terminal === only);
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
