import type { AppVersion } from "../../shared/hostProtocol";
import { timeAgo } from "./memory";

/** Where an update check is: an error carries git's reason. */
export type UpdateState =
  "idle" | "checking" | "up-to-date" | "updated" | { error: string };

const shortSha = (sha: string) => sha.slice(0, 7);

/** "Sep 26, 2026 · 2 days ago". */
function committed(date: string, now: number) {
  const when = new Date(date);
  const day = when.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${day} · ${timeAgo(when.getTime(), now)}`;
}

/** "a1b2c3d · Sep 26, 2026 · 2 days ago". */
export function versionLine({ sha, date }: AppVersion, now = Date.now()) {
  return `${shortSha(sha)} · ${committed(date, now)}`;
}

/**
 * The macOS About panel's lines, "a1b2c3d (Sep 26, 2026 · 2 days ago)"
 * over the commit message; null keeps the bundle's version.
 */
export function aboutPanel(version: AppVersion | null, now = Date.now()) {
  if (!version) return null;
  return {
    version: shortSha(version.sha),
    shortVersion: committed(version.date, now),
    credits: version.subject,
  };
}

/** The line under Updates: what it does before a check, git's reason after a failed one. */
export function updateDescription(state: UpdateState): string | undefined {
  if (typeof state === "object") return state.error;
  return state === "idle"
    ? "Gets the latest version and reloads the app."
    : undefined;
}

/** The update button: its label, and whether it spins or is done. */
export function updateButton(state: UpdateState) {
  switch (state) {
    case "checking":
      return { label: "Checking for updates", spinning: true, disabled: true };
    case "updated":
      return { label: "Reloading", spinning: true, disabled: true };
    case "up-to-date":
      return { label: "Up to date", spinning: false, disabled: true };
    default:
      return { label: "Check for updates", spinning: false, disabled: false };
  }
}
