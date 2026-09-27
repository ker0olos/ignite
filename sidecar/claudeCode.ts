import { execFile, spawn } from "node:child_process";

export type ClaudeCodeStatus = { installed: boolean; loggedIn: boolean };

/** The user's Claude Code install, whose login pi-claude-bridge runs on. */
export type ClaudeCode = {
  status(): Promise<ClaudeCodeStatus>;
  /** Runs Claude Code's own sign-in; `onUrl` gets the sign-in page. */
  login(signal: AbortSignal, onUrl: (url: string) => void): Promise<void>;
};

/** Talks to the `claude` command; tests pass a stand-in script. */
export function createClaudeCode(
  command = "claude",
  timeoutMs = 10_000,
): ClaudeCode {
  return {
    // A `claude` that waits on a prompt would otherwise hang app startup.
    status: () =>
      new Promise((resolve) =>
        execFile(
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
        ),
      ),

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
