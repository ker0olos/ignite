import { FolderGit2, GitBranch } from "lucide-react";
import type { GitReview } from "../../../shared/git";

/** The repository and branch a review's git call runs in. */
export function GitReviewPlace({
  place,
}: {
  place: NonNullable<GitReview["place"]>;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5">
        <FolderGit2 className="size-3.5 shrink-0" />
        <span className="truncate text-foreground">{place.name}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate font-mono">
          {place.branch ?? "detached HEAD"}
        </span>
      </span>
    </div>
  );
}
