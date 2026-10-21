import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitCommitVertical,
} from "lucide-react";
import type { GitReview } from "../../../shared/git";
import { GitCommitHeader } from "@/components/conversation/GitCommitHeader";
import { GitCommitList } from "@/components/conversation/GitCommitList";
import { GitPrHeader } from "@/components/conversation/GitPrHeader";

// A commit that opens a pull request lists itself, not yet hashed, above the branch's earlier commits.
function reviewCommits(review: GitReview) {
  const commits = review.commits ?? [];
  if (review.kind !== "commit") return commits;
  const subject = (review.message ?? "").trim().split("\n")[0];
  return [{ hash: "new", subject: subject || "No message" }, ...commits];
}

/** A review's headline: a commit's message, a pull request, or the commits a push or pull moves. */
export function GitReviewHeader({ review }: { review: GitReview }) {
  if (review.kind === "commit" && !review.pr) {
    return <GitCommitHeader message={review.message} push={review.push} />;
  }
  const commits = reviewCommits(review);
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
