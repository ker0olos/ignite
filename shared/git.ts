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
  kind: "commit" | "push";
  /** The repository, absolute. */
  repo: string;
  range: string;
  files: GitChange[];
  /** The commit message, for a commit. */
  message?: string;
  /** The commits a push sends, newest first. */
  commits?: { hash: string; subject: string }[];
};

/** A range `git_diff` accepts: a keyword or commit hashes, never an option. */
export function validRange(range: string): boolean {
  return (
    range === "staged" ||
    range === "HEAD" ||
    /^[0-9a-f]{4,64}(?:\.\.\.?[0-9a-f]{4,64}|\^!)$/.test(range)
  );
}
