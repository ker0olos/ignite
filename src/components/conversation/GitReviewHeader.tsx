import { ArrowUpFromLine, GitCommitHorizontal } from "lucide-react";
import type { GitReview } from "../../../shared/git";

/** A commit's message, or the commits a push sends, as the review's headline. */
export function GitReviewHeader({ review }: { review: GitReview }) {
  if (review.kind === "commit") {
    const [subject, ...body] = (review.message ?? "").trim().split("\n");
    return (
      <div className="space-y-1 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitCommitHorizontal className="size-3.5" />
          Commit
        </p>
        <p className="text-[14px] font-medium text-foreground">
          {subject || "No message"}
        </p>
        {body.join("\n").trim() && (
          <p className="text-[13px] whitespace-pre-wrap text-muted-foreground">
            {body.join("\n").trim()}
          </p>
        )}
      </div>
    );
  }
  const commits = review.commits ?? [];
  return (
    <div className="space-y-1.5 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowUpFromLine className="size-3.5" />
        Push {commits.length} {commits.length === 1 ? "commit" : "commits"}
      </p>
      {commits.map((c) => (
        <div key={c.hash} className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-[14px] font-medium text-foreground">
            {c.subject}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {c.hash}
          </span>
        </div>
      ))}
    </div>
  );
}
