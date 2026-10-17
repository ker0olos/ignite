import { spawn } from "node:child_process";

/** Says what a build is doing now: "Installing packages…". */
export type Step = (text: string) => void;

const TAIL = 20_000;

/**
 * Runs a build tool (pnpm, npm, Vite, cargo) to completion; its output goes
 * in the error when it fails, or with IGNITE_VERBOSE set, to the terminal as it runs.
 */
export function runTool(
  cmd: string,
  args: string[],
  {
    cwd,
    env = {},
    shell = false,
  }: { cwd: string; env?: object; shell?: boolean },
) {
  const line = [cmd, ...args].join(" ");
  const verbose = !!process.env.IGNITE_VERBOSE;
  // Through a shell, one command line: Node warns about arguments it doesn't escape.
  const child = spawn(shell ? line : cmd, shell ? [] : args, {
    cwd,
    env: { ...process.env, ...env },
    shell,
    stdio: verbose
      ? ["ignore", "inherit", "inherit"]
      : ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const keep = (data: Buffer) => {
    output = (output + data).slice(-TAIL);
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${line} failed (exit ${code})\n${output.trim()}`));
    });
  });
}
