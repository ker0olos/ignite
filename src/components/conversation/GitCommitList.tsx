import type { LucideIcon } from "lucide-react";
import type { GitReview } from "../../../shared/git";

// A pull can bring in hundreds; the files below matter more.
const MAX_COMMITS = 5;

/** A labelled list of commits, subject first, the first few only. */
export function GitCommitList({
  icon: Icon,
  label,
  commits,
}: {
  icon: LucideIcon;
  label: string;
  commits: NonNullable<GitReview["commits"]>;
}) {
  const shown = commits.slice(0, MAX_COMMITS);
  return (
    <div className="space-y-1.5 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {[label, commits.length, commits.length === 1 ? "commit" : "commits"]
          .filter((part) => part !== "")
          .join(" ")}
      </p>
      {shown.map((c) => (
        <div key={c.hash} className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-[14px] font-medium text-foreground">
            {c.subject}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {c.hash}
          </span>
        </div>
      ))}
      {commits.length > shown.length && (
        <p className="text-xs text-muted-foreground">
          and {commits.length - shown.length} more
        </p>
      )}
    </div>
  );
}
