import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";

/** A finished git call's review, above the tool's own text output if any. */
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
      {text && <OutputPreview text={text} />}
    </div>
  );
}
