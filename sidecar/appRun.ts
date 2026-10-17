import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Says what a build is doing now: "Installing packages…". */
export type Step = (text: string) => void;

const TAIL = 20_000;

/**
 * A Step that prints what setup does now, and writes it to `log` after the
 * time it has taken ("0:12  Installing packages…"), where the tools' output goes.
 */
export function stepper(log: string, now = Date.now): Step {
  mkdirSync(dirname(log), { recursive: true });
  const started = now();
  return (text) => {
    const s = Math.round((now() - started) / 1000);
    const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    console.log(text);
    appendFileSync(log, `${time}  ${text}\n`);
  };
}

/**
 * Runs a build tool (pnpm, npm, Vite, cargo) to completion. Its output goes in
 * the error when it fails, to IGNITE_TOOL_LOG's file when set (setup's log),
 * and with IGNITE_VERBOSE set, to the terminal as it runs.
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
  const log = process.env.IGNITE_TOOL_LOG;
  if (log) appendFileSync(log, `$ ${line}\n`);
  // Through a shell, one command line: Node warns about arguments it doesn't escape.
  const child = spawn(shell ? line : cmd, shell ? [] : args, {
    cwd,
    env: { ...process.env, ...env },
    shell,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const keep = (data: Buffer, terminal: NodeJS.WriteStream) => {
    output = (output + data).slice(-TAIL);
    if (log) appendFileSync(log, data);
    if (verbose) terminal.write(data);
  };
  child.stdout.on("data", (d: Buffer) => keep(d, process.stdout));
  child.stderr.on("data", (d: Buffer) => keep(d, process.stderr));
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${line} failed (exit ${code})\n${output.trim()}`));
    });
  });
}
