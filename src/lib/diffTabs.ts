import type { GitChange, GitReview } from "../../shared/git";
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

/** How a tab strip shows one tab: a file path, or a diff at some range. */
export function tabLabel(
  tab: string,
  folder: string,
): {
  name: string;
  detail?: string;
  iconPath: string;
  title: string;
  status?: GitChange["status"];
} {
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
  return (kind === "commit" || kind === "push") && Array.isArray(files)
    ? (details as GitReview)
    : null;
}
