/** Every shell the app runs (the user's terminals, the agent's bash) runs in a PTY, so programs act as in a terminal. */
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import xterm from "@xterm/headless";
import { spawn, type IPty } from "node-pty";
import { APP_NAME } from "../src/lib/app.ts";

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

// Set by start.ts for pi in the sidecar, not for pi run in a shell.
const SIDECAR_ONLY = new Set(["PI_CODING_AGENT_DIR", "PI_TELEMETRY"]);

/** `env` as a terminal's, minus what points pi at the app's own files. */
export function terminalEnv(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && !SIDECAR_ONLY.has(key)) out[key] = value;
  }
  return {
    ...out,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: APP_NAME,
  };
}

/** Starts `file` in a new PTY; its pid leads its own process group. */
export function spawnPty(
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: Record<string, string>;
    cols?: number;
    rows?: number;
  },
): IPty {
  fixSpawnHelper();
  return spawn(file, args, {
    name: "xterm-256color",
    cols: options.cols ?? 120,
    rows: options.rows ?? 40,
    cwd: options.cwd,
    env: options.env,
  });
}

/** Signals `pid` and everything it started. */
export function killTree(
  pid: number,
  signal: "SIGTERM" | "SIGKILL" = "SIGTERM",
) {
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

/**
 * A PTY's output as the lines a terminal ends up showing, for the agent:
 * colors, cursor moves and spinners rendered away. Each line is passed on
 * once it ends; `end` passes the last one.
 */
export function screenText(onText: (text: string) => void, cols = 120) {
  const screen = new xterm.Terminal({
    cols,
    rows: 40,
    // Room for a long line's wrapped rows (minified JS, a JSON reply).
    scrollback: 1000,
    allowProposedApi: true,
  });
  const buffer = () => screen.buffer.active;
  // The text of the row `row` ends, with the rows it wrapped from.
  const lineEndingAt = (row: number) => {
    const parts: string[] = [];
    for (let r = row; r >= 0; r--) {
      const line = buffer().getLine(r);
      if (!line) break;
      parts.unshift(line.translateToString(true));
      if (!line.isWrapped) break;
    }
    return parts.join("").trimEnd();
  };
  screen.onLineFeed(() => {
    const b = buffer();
    if (b.type === "normal")
      onText(`${lineEndingAt(b.baseY + b.cursorY - 1)}\n`);
  });
  const current = () => {
    const b = buffer();
    return lineEndingAt(b.baseY + b.cursorY);
  };
  return {
    write: (data: string) => screen.write(data),
    /** The line still being written (a prompt, "ready" with no newline), not yet passed on. */
    pending: current,
    end: () =>
      new Promise<void>((resolve) =>
        screen.write("", () => {
          const last = current();
          if (last.trim()) onText(last);
          screen.dispose();
          resolve();
        }),
      ),
  };
}
