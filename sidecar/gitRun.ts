/**
 * Runs git and gh outside the sandbox, with the user's credentials. Nothing
 * may wait on a terminal: prompts, pagers and editors are switched off.
 */
import { spawn } from "node:child_process";
import { truncateTail } from "@earendil-works/pi-coding-agent";

const TIMEOUT_MS = 10 * 60_000;

const QUIET_ENV = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_EDITOR: "true",
  GIT_MERGE_AUTOEDIT: "no",
  GH_PROMPT_DISABLED: "1",
  GH_PAGER: "cat",
  GH_NO_UPDATE_NOTIFIER: "1",
  NO_COLOR: "1",
};

// Hooks can live in the working tree (husky's core.hooksPath), which sandboxed
// commands may edit; only a call the user approved runs them.
const NO_HOOKS = {
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "core.hooksPath",
  GIT_CONFIG_VALUE_0: "/dev/null",
};

export type RunOptions = {
  cwd: string;
  signal?: AbortSignal;
  /** Runs the repository's hooks: only for calls the user approved. */
  hooks?: boolean;
  timeout?: number;
};

/** A finished run: stdout and stderr as they arrived, and the exit code. */
export type RunResult = { output: string; code: number | null };

/** Runs `program` with `args`, collecting its output. Rejects only if it can't start. */
export function run(
  program: string,
  args: string[],
  { cwd, signal, hooks = false, timeout = TIMEOUT_MS }: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...QUIET_ENV, ...(hooks ? {} : NO_HOOKS) };
    const child = spawn(program, args, {
      cwd,
      env,
      signal,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d: Buffer) => (output += d.toString()));
    child.stderr.on("data", (d: Buffer) => (output += d.toString()));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`${program} isn't installed or isn't on PATH.`));
      } else if (error.name !== "AbortError") reject(error);
    });
    child.on("close", (code) => resolve({ output, code }));
  });
}

/** Output as the model reads it: its tail, and why it failed. */
export function resultText({ output, code }: RunResult): string {
  const { content } = truncateTail(output.trimEnd());
  const text = content || "(no output)";
  if (code === 0) return text;
  return `${text}\n\n${code === null ? "Stopped" : `Exited with code ${code}`}`;
}
