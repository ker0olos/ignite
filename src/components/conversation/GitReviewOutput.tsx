import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { OutputPreview } from "@/components/conversation/OutputPreview";
import { RunningLine } from "@/components/conversation/RunningLine";
import { withoutDiffstat } from "@/lib/gitDiff";

/** A git call's review, above its output, or a running line until that comes. */
export function GitReviewOutput({
  review,
  text,
  running,
}: {
  review: GitReview;
  text: string;
  running: boolean;
}) {
  return (
    <div className="space-y-2">
      <GitChanges review={review} />
      {text ? (
        <OutputPreview text={withoutDiffstat(text)} />
      ) : (
        running && <RunningLine />
      )}
    </div>
  );
}
