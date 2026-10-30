import { openUrl } from "@tauri-apps/plugin-opener";
import { GitPullRequestArrow } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GitReview } from "../../../shared/git";
import { LinkPill } from "@/components/conversation/LinkPill";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import { redline, remarkRedline } from "@/lib/redline";

const COMPONENTS: Components = {
  a: ({ href = "", children }) => (
    <LinkPill kind="url" onOpen={() => href && openUrl(href).catch(() => {})}>
      {children}
    </LinkPill>
  ),
};

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
        <div className="px-4 py-3 leading-relaxed [&_del]:rounded-sm [&_del]:bg-destructive/20 [&_del]:text-destructive [&_h1]:mb-2 [&_h1]:text-[1.2em] [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:border-b [&_h2]:pb-1 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_ins]:rounded-sm [&_ins]:bg-success/20 [&_ins]:no-underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p]:last:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkRedline]}
            components={COMPONENTS}
          >
            {redline(lines)}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
