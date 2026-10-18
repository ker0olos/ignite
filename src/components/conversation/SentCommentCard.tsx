import { useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { commentPlace, type SentComment } from "../../../shared/sentComments";
import { cn } from "@/lib/utils";

/** A diff comment a message carried: where it is, the comment, and the lines it's on when opened. */
export function SentCommentCard({ comment }: { comment: SentComment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-muted/30 text-[13px]">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2.5 pt-1.5 text-left text-xs text-muted-foreground outline-none hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <MessageSquare className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono">
          {commentPlace(comment.path, comment.lines)}
        </span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mx-2.5 mt-1.5 overflow-x-auto rounded border bg-background py-1 font-mono text-[12px] leading-[18px]">
          {comment.lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                "flex min-w-fit",
                l.kind === "add" && "bg-success/15",
                l.kind === "del" && "bg-destructive/15",
              )}
            >
              <span className="w-10 shrink-0 pr-2 text-right text-muted-foreground select-none">
                {l.num}
              </span>
              <span className="pr-3 whitespace-pre">{l.text}</span>
            </div>
          ))}
        </div>
      )}
      <p className="px-2.5 pt-1 pb-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {comment.text}
      </p>
    </div>
  );
}
