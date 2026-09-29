import type { GitReview } from "../../../shared/git";
import { GitChangeRow } from "@/components/conversation/GitChangeRow";
import { GitReviewHeader } from "@/components/conversation/GitReviewHeader";

/** A commit or push's review: its message or commits, then its changed files. */
export function GitChanges({ review }: { review: GitReview }) {
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-muted/30">
      <GitReviewHeader review={review} />
      <div className="space-y-1 px-1.5 py-2">
        <div className="flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
          <span>Changes</span>
          <span className="rounded-full bg-muted px-1.5 text-[11px]">
            {review.files.length}
          </span>
        </div>
        {review.files.length === 0 ? (
          <p className="px-1.5 text-[13px] text-muted-foreground">
            No file changes.
          </p>
        ) : (
          review.files.map((file) => (
            <GitChangeRow
              key={file.path}
              repo={review.repo}
              range={review.range}
              file={file}
            />
          ))
        )}
      </div>
    </div>
  );
}
