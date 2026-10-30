import { GitPullRequestArrow } from "lucide-react";
import type { GitReview } from "../../../shared/git";
import { MarkdownPage } from "@/components/conversation/MarkdownPage";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import { redline, remarkRedline } from "@/lib/redline";

/** What `gh pr edit` changes: the pull request's title and description as they'll read, its additions and removals marked. */
export function GitPrEdit({ edit }: { edit: NonNullable<GitReview["edit"]> }) {
  const lines = parseUnifiedDiff(edit.diff);
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
        <GitPullRequestArrow className="size-3.5" />
        <span className="flex-1">{edit.pr} · description</span>
        <span className="text-success">+{added}</span>
        <span className="text-destructive">−{removed}</span>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground">
          No change to its title or description.
        </p>
      ) : (
        <MarkdownPage
          text={redline(lines)}
          plugins={[remarkRedline]}
          className="px-4 py-3 [&_h2]:border-b [&_h2]:pb-1 [&_del]:rounded-sm [&_del]:bg-destructive/20 [&_del]:text-destructive [&_ins]:rounded-sm [&_ins]:bg-success/20 [&_ins]:no-underline"
        />
      )}
    </div>
  );
}
