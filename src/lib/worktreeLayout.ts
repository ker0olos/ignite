import type { WorktreeLayout } from "../../shared/git";

const KEY = "worktree-layout";

type Saved = Record<string, WorktreeLayout>;

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

/** The folder's last known worktree layout, from any earlier launch too; undefined when never read. */
export function cachedLayout(folder: string): WorktreeLayout | undefined {
  return load()[folder];
}

/** Remembers the folder's worktree layout. */
export function cacheLayout(folder: string, layout: WorktreeLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), [folder]: layout }));
  } catch {
    // Only a head start; without storage it's read again next launch.
  }
}

/** Where a conversation's files are: the folder before its first message, else its worktree (from its reply or the folder's layout); null while unknown. */
export function conversationRoot(
  folder: string | null,
  session: string | null | undefined,
  workdir: string | null,
  layout: WorktreeLayout | undefined,
): string | null {
  if (folder === null || session === undefined) return null;
  if (session === null) return folder;
  if (workdir) return workdir;
  if (layout === undefined) return null;
  if (layout === null) return folder;
  const sep = layout.base.includes("\\") ? "\\" : "/";
  return [layout.base, session, layout.prefix].filter(Boolean).join(sep);
}
