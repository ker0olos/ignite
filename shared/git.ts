/** The git and gh tools' names, and what a commit or push shows for review (used by both). */

export const GIT_TOOL = "git";
export const GH_TOOL = "gh";

/** One changed file; counts are null for a binary file. */
export type GitChange = {
  path: string;
  status: "M" | "A" | "D" | "T" | "U";
  added: number | null;
  removed: number | null;
};

/**
 * What a commit or push changes. `range` is what `git_diff` compares:
 * "staged", "HEAD" (the working tree), or two commits (`a...b`, `a^!`).
 */
export type GitReview = {
  /** "update": what a pull, merge or rebase brought in; "pr": a pull request to open. */
  kind: "commit" | "push" | "update" | "pr";
  /** The repository, absolute. */
  repo: string;
  range: string;
  files: GitChange[];
  /** The repository's origin owner/name (else its folder's name) and branch (none when detached). */
  place?: { name: string; branch?: string };
  /** The branch a commit pushes to origin right after. */
  push?: string;
  /** The commit message, for a commit. */
  message?: string;
  /** The commits a push sends or an update brought in, newest first. */
  commits?: { hash: string; subject: string }[];
  /** The pull request `gh pr create` would open; `repo` is owner/name. */
  pr?: {
    repo: string;
    base: string;
    head: string;
    title: string;
    body: string;
    draft: boolean;
  };
};

/** A repository a conversation worked in: what of its work isn't committed, pushed or merged. */
export type GitRepoStatus = {
  repo: string;
  /** Its origin's owner/name, else its folder's name. */
  name: string;
  /** None when detached. */
  branch?: string;
  /** The user's checkout at this path, when `repo` is the conversation's own worktree of it. */
  checkout?: string;
  /** `repo` is the user's checkout itself, which the conversation works in. */
  shared?: boolean;
  /** Files with uncommitted changes, untracked ones included. */
  changed: number;
  /** Commits no remote has; 0 when it has no remote. */
  unpushed: number;
  /** The branch's latest pull request. */
  pr?: {
    number: number;
    url: string;
    state: "OPEN" | "MERGED" | "CLOSED";
    isDraft: boolean;
  };
};

/** What a repository's pill opens: its uncommitted files (range "HEAD") and the commits no remote has. */
export type GitRepoDetails = {
  files: GitChange[];
  commits: { hash: string; subject: string }[];
};

/** A range `git_diff` accepts: a keyword or commit hashes, never an option. */
export function validRange(range: string): boolean {
  return (
    range === "staged" ||
    range === "HEAD" ||
    /^[0-9a-f]{4,64}(?:\.\.\.?[0-9a-f]{4,64}|\^!)$/.test(range) ||
    // A pull request's branches on GitHub: gh:owner/name:base...head.
    /^gh:[\w.-]+\/[\w.-]+:[\w.][\w./-]*\.\.\.[\w.][\w./:-]*$/.test(range)
  );
}

/** A folder's conversations work in `<base>/<id>/<prefix>` (`prefix`: the folder's place in its repository); null: they share the folder. */
export type WorktreeLayout = { base: string; prefix: string } | null;

export type GitRequest =
  /** One file's diff in a review's range (see GitReview). */
  | { id: number; type: "git_diff"; repo: string; range: string; path: string }
  /** The repositories an open conversation worked in, as they stand now; none before it opens. */
  | { id: number; type: "git_status"; session: string }
  /** A repository's uncommitted files and unpushed commits. */
  | { id: number; type: "git_repo_details"; repo: string }
  /** Discards one file's uncommitted changes (`path` relative to `repo`). */
  | { id: number; type: "git_discard"; repo: string; path: string }
  /** Where the folder's conversations' worktrees are, so the app knows one's before it opens. */
  | { id: number; type: "worktree_layout"; cwd: string }
  /** Settles once an open conversation's worktree has the folder's ignored files (.env, builds). */
  | { id: number; type: "worktree_ready"; session: string };

export type GitResponses = {
  git_diff: string;
  /** null until the conversation's session is open (its worktree isn't known yet). */
  git_status: GitRepoStatus[] | null;
  git_repo_details: GitRepoDetails;
  git_discard: undefined;
  worktree_layout: WorktreeLayout;
  worktree_ready: undefined;
};
