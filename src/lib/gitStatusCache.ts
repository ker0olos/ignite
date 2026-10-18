import type { GitRepoStatus } from "../../shared/git";

const KEY = "git-status";
const MAX = 200;

type Saved = Record<string, GitRepoStatus[]>;

function load(): Saved {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Saved)
      : {};
  } catch {
    return {};
  }
}

let cache: Saved | null = null;

/** The conversation's last known repositories, from any earlier launch too; undefined when never read. */
export function cachedGitStatus(session: string): GitRepoStatus[] | undefined {
  cache ??= load();
  return cache[session];
}

/** Remembers the conversation's repositories, keeping the newest 200 conversations'. */
export function cacheGitStatus(session: string, repos: GitRepoStatus[]) {
  cache ??= load();
  const kept = Object.entries(cache)
    .filter(([s]) => s !== session)
    .slice(-(MAX - 1));
  cache = { ...Object.fromEntries(kept), [session]: repos };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Only a head start; without storage it's in memory until a reload.
  }
}
