import { MessageSquare } from "lucide-react";
import { commentPlace } from "../../../shared/sentComments";
import { useOpenTab } from "@/hooks/useOpenTab";
import { revealDiffComment, type DiffComment } from "@/lib/diffComments";
import { diffTabId } from "@/lib/diffTabs";
import { basename } from "@/lib/paths";

/** A diff comment in the composer's message, as tall as an image's thumbnail; clicked, it opens its diff on it. */
export function CommentAttachment({
  comment,
  session,
}: {
  comment: DiffComment;
  /** The conversation it's for, whose diff tab it opens. */
  session: string | null;
}) {
  const openTab = useOpenTab();
  const { diff, path, lines, text } = comment;
  return (
    <button
      type="button"
      title={`${commentPlace(path, lines)}\n${text}`}
      disabled={!diff}
      className="flex h-14 w-52 items-start gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-left text-[13px] outline-none disabled:cursor-default"
      onClick={() => {
        if (!diff) return;
        openTab(diffTabId({ ...diff, path, session: session ?? undefined }));
        revealDiffComment(comment.id);
      }}
    >
      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted-foreground">
          {commentPlace(basename(path), lines)}
        </span>
        <span className="line-clamp-1 [overflow-wrap:anywhere]">{text}</span>
      </span>
    </button>
  );
}
