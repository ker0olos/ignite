import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitCommitVertical,
} from "lucide-react";
import type { GitReview } from "../../../shared/git";
import { GitCommitHeader } from "@/components/conversation/GitCommitHeader";
import { GitCommitList } from "@/components/conversation/GitCommitList";
import { GitPrHeader } from "@/components/conversation/GitPrHeader";

/** A review's headline: a commit's message, a pull request, or the commits a push or pull moves. */
export function GitReviewHeader({ review }: { review: GitReview }) {
  const commits = review.commits ?? [];
  if (review.kind === "commit") {
    return <GitCommitHeader message={review.message} push={review.push} />;
  }
  if (review.pr) {
    return (
      <>
        <GitPrHeader pr={review.pr} />
        {commits.length > 0 && (
          <GitCommitList icon={GitCommitVertical} label="" commits={commits} />
        )}
      </>
    );
  }
  const push = review.kind === "push";
  return (
    <GitCommitList
      icon={push ? ArrowUpFromLine : ArrowDownToLine}
      label={push ? "Push" : "Brought in"}
      commits={commits}
    />
  );
}
