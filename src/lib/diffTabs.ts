import type { LucideIcon } from "lucide-react";
import type { GitChange, GitReview } from "../../shared/git";
import { childTabLabel, readChildTab } from "@/lib/childTabs";
import { basename } from "@/lib/paths";

/** A file's diff at some range, opened as a tab alongside file paths. */
export type DiffTab = {
  repo: string;
  range: string;
  path: string;
  status: GitChange["status"];
};

const PREFIX = "diff:";

/** Encodes a diff tab as a tab id, distinct from a plain file path. */
export function diffTabId(tab: DiffTab): string {
  const { repo, range, path, status } = tab;
  return PREFIX + JSON.stringify({ repo, range, path, status });
}

/** Decodes a tab id back to a diff tab, or null for a file path or malformed id. */
export function readDiffTab(id: string): DiffTab | null {
  if (!id.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(id.slice(PREFIX.length));
    const { repo, range, path, status } = parsed as Partial<DiffTab>;
    if (!repo || !range || !path || !status) return null;
    return { repo, range, path, status };
  } catch {
    return null;
  }
}

/** A range as shown to the user: "Staged", "Working Tree", or shortened hashes. */
export function rangeLabel(range: string): string {
  if (range === "staged") return "Staged";
  if (range === "HEAD") return "Working Tree";
  const pr = /^gh:[^:]+:(.+)\.\.\.(.+)$/.exec(range);
  if (pr) return `${pr[1]} ← ${pr[2]}`;
  const short = (hash: string) => hash.slice(0, 7);
  const single = /^([0-9a-f]{4,64})\^!$/.exec(range);
  if (single) return short(single[1]);
  const pair = /^([0-9a-f]{4,64})\.\.\.?([0-9a-f]{4,64})$/.exec(range);
  return pair ? `${short(pair[1])}..${short(pair[2])}` : range;
}

function relativeTo(path: string, folder: string): string {
  return path === folder || path.startsWith(folder + "/")
    ? path.slice(folder.length + 1)
    : path;
}

/** How a tab strip shows one tab: a file path, a diff at some range, or a conversation's subagent or background command. */
export function tabLabel(
  tab: string,
  folder: string,
): {
  name: string;
  detail?: string;
  iconPath: string;
  /** Instead of the file icon `iconPath` picks. */
  icon?: LucideIcon;
  title: string;
  status?: GitChange["status"];
} {
  const child = readChildTab(tab);
  if (child) return { ...childTabLabel(child), iconPath: "" };
  const diff = readDiffTab(tab);
  if (!diff) {
    return {
      name: basename(tab),
      iconPath: tab,
      title: relativeTo(tab, folder),
    };
  }
  return {
    name: basename(diff.path),
    detail: rangeLabel(diff.range),
    iconPath: diff.path,
    title: relativeTo(`${diff.repo}/${diff.path}`, folder),
    status: diff.status,
  };
}

/** Reads a tool result's `details` as a git review, if that's what it is. */
export function readGitReview(details: unknown): GitReview | null {
  if (typeof details !== "object" || details === null) return null;
  const { kind, files } = details as Partial<GitReview>;
  return ["commit", "push", "update", "pr"].includes(kind ?? "") &&
    Array.isArray(files)
    ? (details as GitReview)
    : null;
}

/** The review a git row shows: its result's, or the approved one until that arrives. */
export function shownReview(run: {
  result?: { details?: unknown };
  review?: GitReview;
}): GitReview | null {
  return readGitReview(run.result?.details) ?? run.review ?? null;
}
