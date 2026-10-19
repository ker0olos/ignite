import { APP_NAME } from "./app";

/** The line under the memory switch: what it does. */
export function memoryDescription(enabled: boolean, folderOpen: boolean) {
  if (!enabled)
    return "Off. Conversations aren't recorded and nothing is recalled.";
  return folderOpen
    ? "Records what this folder's conversations do and recalls it when a conversation starts."
    : "Records what each folder's conversations do and recalls it when a conversation starts.";
}

const KINDS: Record<string, string> = {
  bugfix: "Fixes",
  feature: "Features",
  refactor: "Refactors",
  change: "Changes",
  discovery: "Discoveries",
  decision: "Decisions",
  security_alert: "Security alerts",
  security_note: "Security notes",
  sensitive: "Sensitive",
};

/** A filter by type: null for every type. */
export type KindFilter = { kind: string | null; label: string; count: number };

/** How many memories `counts` holds in all. */
export const totalOf = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

/** The type filters for `counts`: All, then each type the folder has, most first. */
export function kindFilters(counts: Record<string, number>): KindFilter[] {
  return [
    { kind: null, label: "All", count: totalOf(counts) },
    ...Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([kind, count]) => ({ kind, label: KINDS[kind] ?? kind, count })),
  ];
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
