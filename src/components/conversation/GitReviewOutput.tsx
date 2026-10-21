import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { withoutDiffstat } from "@/lib/gitDiff";

/** A git call's review, above its output once that comes; a pull or merge only says what it brought in. */
export function GitReviewOutput({
  review,
  text,
}: {
  review: GitReview;
  text: string;
}) {
  if (review.kind === "update") {
    const n = review.commits?.length ?? 0;
    return (
      <OutputPreview
        text={withoutDiffstat(text)}
        label={`Brought in ${n} ${n === 1 ? "commit" : "commits"}`}
      />
    );
  }
  return (
    <div className="space-y-2">
      <GitChanges review={review} />
      {text && <OutputPreview text={withoutDiffstat(text)} />}
    </div>
  );
}
