import type { GitReview } from "../../../shared/git";
import { GitChangeRow } from "@/components/conversation/GitChangeRow";
import { GitReviewHeader } from "@/components/conversation/GitReviewHeader";
import { GitReviewPlace } from "@/components/conversation/GitReviewPlace";
import { ScrollMoreChip } from "@/components/conversation/ScrollMoreChip";
import { useHiddenBelow } from "@/hooks/useHiddenBelow";
import { cn } from "@/lib/utils";

/** A commit or push's review: its message or commits, then its changed files. */
export function GitChanges({ review }: { review: GitReview }) {
  const { ref, hidden, update } = useHiddenBelow<HTMLDivElement>(review.files);

  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-muted/30">
      {review.place && <GitReviewPlace place={review.place} />}
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
          <div className="relative">
            {/* Height ends mid-row so a cut-off row shows the list scrolls. */}
            <div
              ref={ref}
              onScroll={update}
              className={cn(
                "max-h-[19rem] space-y-1 overflow-y-auto",
                hidden > 0 &&
                  "[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
              )}
            >
              {review.files.map((file) => (
                <GitChangeRow
                  key={file.path}
                  repo={review.repo}
                  range={review.range}
                  file={file}
                />
              ))}
            </div>
            {hidden > 0 && (
              <ScrollMoreChip
                count={hidden}
                onClick={() =>
                  ref.current?.scrollBy({
                    top: ref.current.clientHeight * 0.8,
                    behavior: "smooth",
                  })
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
