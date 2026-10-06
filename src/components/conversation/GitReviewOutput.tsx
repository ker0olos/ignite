import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { withoutDiffstat } from "@/lib/gitDiff";

/** A git call's review, above its output once that comes. */
export function GitReviewOutput({
  review,
  text,
}: {
  review: GitReview;
  text: string;
}) {
  return (
    <div className="space-y-2">
      <GitChanges review={review} />
      {text && <OutputPreview text={withoutDiffstat(text)} />}
    </div>
  );
}
