import { GitBranch } from "lucide-react";
import type { GitRepoStatus } from "../../../shared/git";
import { cn } from "@/lib/utils";

/** What a repository has checked out, tagged as the conversation's own worktree or (a warning) the user's checkout. */
export function GitRepoWhere({ status }: { status: GitRepoStatus }) {
  const tag = status.checkout
    ? { text: "Worktree", title: status.repo, warn: false }
    : status.shared
      ? { text: "Your checkout", title: status.repo, warn: true }
      : null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <GitBranch className="size-3 shrink-0" />
      <span className="truncate font-mono">
        {status.branch ?? (status.checkout ? "No branch yet" : "detached HEAD")}
      </span>
      {tag && (
        <span
          title={tag.title}
          className={cn(
            "shrink-0 rounded-full bg-muted px-1.5 text-[11px]",
            tag.warn && "text-warning",
          )}
        >
          {tag.text}
        </span>
      )}
    </p>
  );
}
