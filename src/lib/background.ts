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
