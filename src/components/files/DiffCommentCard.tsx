import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiffComment } from "@/lib/diffComments";
import { commentPlace } from "@/lib/diffCommentMessage";
import { basename } from "@/lib/paths";

/** A saved comment under its last line: where it is, its text, Edit and Delete. */
export function DiffCommentCard({
  comment,
  onEdit,
  onDelete,
}: {
  comment: DiffComment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="sticky left-0 w-full max-w-xl px-3 py-1.5 font-sans text-[13px] leading-normal">
      <div className="rounded-md border bg-background px-2.5 py-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            {commentPlace(basename(comment.path), comment.lines)}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Edit comment"
            title="Edit"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Delete comment"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {comment.text}
        </p>
      </div>
    </div>
  );
}
