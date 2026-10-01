import type { BackgroundOutput } from "../../shared/agentStatus";

/** A background command's state in words: running, or how it ended. */
export function backgroundState(
  shown: BackgroundOutput | null,
  pid: number,
): string {
  if (!shown) return `pid ${pid}`;
  if (shown.running) return `Running · pid ${pid}`;
  if (shown.exitCode === undefined) return "Stopped";
  return `Exited with code ${shown.exitCode}`;
}

/** The command as a shell prompt shows it: a magenta ❯, the program in green. */
export function promptLine(command: string): string {
  const [, program, rest] = /^(\S*)(.*)$/s.exec(command.trim())!;
  return `\x1b[35m❯\x1b[0m \x1b[32m${program}\x1b[0m${rest}`;
}
