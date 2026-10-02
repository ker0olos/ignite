import { openUrl } from "@tauri-apps/plugin-opener";
import { GitPullRequest } from "lucide-react";
import { conversationPrs } from "@/lib/conversationPrs";
import type { Transcript } from "@/lib/transcript";

const LINK =
  "text-xs outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline";

/** Links to the pull requests the conversation opened, after the approval menu. */
export function PullRequestLinks({
  transcript,
}: {
  transcript: Transcript | null;
}) {
  const prs = transcript ? conversationPrs(transcript) : [];
  if (prs.length === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <GitPullRequest className="size-3.5" aria-hidden="true" />
      {prs.map((pr, i) => (
        <span key={pr.url} className="flex items-center gap-1">
          {i > 0 && "·"}
          <button
            type="button"
            title={pr.url}
            className={LINK}
            onClick={() => openUrl(pr.url).catch(() => {})}
          >
            {i === 0 ? `PR #${pr.number}` : `#${pr.number}`}
          </button>
        </span>
      ))}
    </span>
  );
}
