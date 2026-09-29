import type { MemoryStatus } from "../../shared/memory";
import { APP_NAME } from "./app";

/** The line under the cmem switch: what it's doing, or why it can't. */
export function memoryDescription(
  state: MemoryStatus["state"] | undefined,
  enabled: boolean,
  folderOpen: boolean,
): string {
  switch (state) {
    case undefined:
      return "Checking for cmem";
    case "not-installed":
      return "Install cmem to give the agent memory across sessions. It works with Claude Code, Codex, Cursor and other agents.";
    case "stopped":
      return "cmem's worker isn't running. It starts with any agent that uses cmem.";
    case "excluded":
      return "This folder is excluded in cmem's own settings.";
  }
  if (!enabled) return "Off. Sessions aren't recorded and nothing is recalled.";
  return folderOpen
    ? "Records this folder's sessions and recalls past work when a conversation starts."
    : "Records each folder's sessions and recalls past work when a conversation starts.";
}

const PLATFORMS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  [APP_NAME]: "this app",
};

/** Which tool recorded an observation, for its row. */
export const platformName = (platform: string) =>
  PLATFORMS[platform] ?? platform;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "5 minutes ago", "yesterday"; "just now" under a minute. */
export function timeAgo(then: number, now = Date.now()): string {
  const elapsed = now - then;
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return format.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
}
