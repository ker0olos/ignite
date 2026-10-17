import { execFile, spawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type ClaudeCodeStatus = { installed: boolean; loggedIn: boolean };

/** The user's Claude Code install, whose login pi-claude-bridge runs on. */
export type ClaudeCode = {
  status(): Promise<ClaudeCodeStatus>;
  /** Runs Claude Code's own sign-in; `onUrl` gets the sign-in page. */
  login(signal: AbortSignal, onUrl: (url: string) => void): Promise<void>;
};

/** Talks to the user's Claude Code (`claude` when none is found); tests pass a stand-in script. */
export function createClaudeCode(
  command = claudeExecutable() ?? "claude",
  timeoutMs = 10_000,
): ClaudeCode {
  return {
    // A `claude` that waits on a prompt would otherwise hang app startup.
    status: () =>
      new Promise((resolve) => {
        const child = execFile(
          command,
          ["auth", "status"],
          { timeout: timeoutMs },
          (error, stdout, stderr) => {
            if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
              return resolve({ installed: false, loggedIn: false });
            }
            if (error) {
              const why = error.killed
                ? `timed out after ${timeoutMs}ms`
                : error.message;
              process.stderr.write(
                `pi-host: claude auth status ${why}: ${stderr.trim()}\n`,
              );
            }
            try {
              resolve({
                installed: true,
                loggedIn: !!JSON.parse(stdout).loggedIn,
              });
            } catch {
              resolve({ installed: true, loggedIn: false });
            }
          },
        );
        // Some Claude Code versions read stdin to its end before answering.
        child.stdin?.end();
      }),

    // ponytail: not tried against a real signed-out Claude Code; if it hangs
    // waiting for a TTY, run `claude` in a terminal to sign in instead.
    login: (signal, onUrl) =>
      new Promise((resolve, reject) => {
        const child = spawn(command, ["auth", "login", "--claudeai"], {
          signal,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let sent = false;
        const scan = (chunk: Buffer) => {
          const url = /https:\/\/\S+/.exec(chunk.toString())?.[0];
          if (url && !sent) {
            sent = true;
            onUrl(url);
          }
        };
        child.stdout.on("data", scan);
        child.stderr.on("data", scan);
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error(`Claude Code sign-in failed (exit code ${code}).`),
              ),
        );
      }),
  };
}

// npm's Claude Code keeps its binary here, under the folder its shims are in.
const NPM_BINARY = [
  "node_modules",
  "@anthropic-ai",
  "claude-code",
  "bin",
  "claude.exe",
];

// Where Claude Code's installers put it, for when PATH (saved at setup) predates it.
function installed(
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv,
) {
  if (platform !== "win32")
    return [
      join(home, ".local", "bin", "claude"), // the native installer
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
      "/home/linuxbrew/.linuxbrew/bin/claude",
    ];
  const local = env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const roaming = env.APPDATA ?? join(home, "AppData", "Roaming");
  return [
    join(home, ".local", "bin", "claude.exe"), // the native installer
    join(local, "Microsoft", "WinGet", "Links", "claude.exe"),
    join(
      env.ProgramData ?? "C:\\ProgramData",
      "chocolatey",
      "bin",
      "claude.exe",
    ),
    join(home, "scoop", "shims", "claude.exe"),
    join(roaming, "npm", ...NPM_BINARY),
  ];
}

/**
 * The user's Claude Code, or null: the agent SDK runs it, as its own isn't
 * installed. Found on PATH (on Windows claude.exe, the one a process can start,
 * or the binary behind npm's claude.cmd), else where its installers put it.
 */
export function claudeExecutable(
  path = process.env.PATH ?? "",
  platform = process.platform,
  home = homedir(),
  env = process.env,
): string | null {
  const windows = platform === "win32";
  const onPath = path
    .split(windows ? ";" : ":")
    .filter(Boolean)
    .flatMap((dir) =>
      windows
        ? [join(dir, "claude.exe"), join(dir, ...NPM_BINARY)]
        : [join(dir, "claude")],
    );
  const found = [...onPath, ...installed(platform, home, env)].find((file) =>
    statSync(file, { throwIfNoEntry: false })?.isFile(),
  );
  return found ?? null;
}

/** Points pi-claude-bridge (its claude-bridge.json in `agentDir`) at the user's Claude Code, keeping its other settings. */
export async function bridgeToClaude(
  agentDir: string,
  claude = claudeExecutable(),
) {
  if (!claude) return;
  const file = join(agentDir, "claude-bridge.json");
  const text = await readFile(file, "utf8").catch(() => "{}");
  let config: { provider?: Record<string, unknown> };
  try {
    config = JSON.parse(text);
  } catch {
    return; // A file the user broke stays theirs to fix.
  }
  if (config.provider?.pathToClaudeCodeExecutable === claude) return;
  config.provider = { ...config.provider, pathToClaudeCodeExecutable: claude };
  await mkdir(agentDir, { recursive: true });
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
}
