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
      return "Install cmem for shared agent memory. Until then, Ignite uses markdown memory files.";
    case "stopped":
      return "cmem's worker isn't running. Ignite uses markdown memory files meanwhile.";
    case "excluded":
      return "This folder is excluded in cmem's own settings, so Ignite uses markdown memory files.";
  }
  if (!enabled)
    return "Off. Uses Ignite's markdown memory files instead of cmem.";
  return folderOpen
    ? "Records this folder's conversations in cmem, falling back to markdown memory when cmem is unavailable."
    : "Records each folder's conversations in cmem, falling back to markdown memory when cmem is unavailable.";
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
