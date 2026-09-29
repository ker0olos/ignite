import { GitPullRequestArrow } from "lucide-react";
import type { GitReview } from "../../../shared/git";

/** A pull request to open: where it goes, its title and description. */
export function GitPrHeader({ pr }: { pr: NonNullable<GitReview["pr"]> }) {
  return (
    <div className="space-y-1 px-3 py-2.5">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <GitPullRequestArrow className="size-3.5" />
        {pr.draft ? "Draft pull request" : "Pull request"} on {pr.repo}
        <span className="font-mono">
          {pr.base} ← {pr.head}
        </span>
      </p>
      <p className="text-[14px] font-medium text-foreground">
        {pr.title || "No title"}
      </p>
      {pr.body && (
        <p className="line-clamp-6 text-[13px] whitespace-pre-wrap text-muted-foreground">
          {pr.body}
        </p>
      )}
    </div>
  );
}
