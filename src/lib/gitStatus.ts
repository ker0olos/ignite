import type { GitRepoStatus } from "../../shared/git";

/** The repositories with work not yet committed, pushed or merged; a merged or closed pull request with nothing after it is done. */
export const unfinished = (repos: GitRepoStatus[]) =>
  repos.filter(
    (r) => r.changed > 0 || r.unpushed > 0 || r.pr?.state === "OPEN",
  );

/** A repository's name without its owner: `lead-led/motr-expo` → `motr-expo`. */
export const shortName = (name: string) => name.split("/").pop() || name;

/** A pull request's state as the composer words it. */
export function prState(
  pr: NonNullable<GitRepoStatus["pr"]>,
): "open" | "draft" | "merged" | "closed" {
  if (pr.state === "OPEN") return pr.isDraft ? "draft" : "open";
  return pr.state === "MERGED" ? "merged" : "closed";
}
