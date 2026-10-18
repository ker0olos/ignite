import { DiffCommentBox } from "@/components/files/DiffCommentBox";
import { DiffCommentCard } from "@/components/files/DiffCommentCard";
import type { CommentDraft } from "@/hooks/useCommentSelection";
import type { DiffComment } from "@/lib/diffComments";

/** What shows under a diff row: the comments ending there (one being edited as its box), and a new comment's box. */
export function DiffRowComments({
  comments,
  draft,
  onAdd,
  onEdit,
  onSave,
  onDelete,
  onClose,
}: {
  /** The comments ending at this row. */
  comments: DiffComment[];
  /** The open box, when it ends at this row. */
  draft: CommentDraft | null;
  onAdd: (text: string) => void;
  onEdit: (comment: DiffComment) => void;
  onSave: (id: number, text: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  if (!comments.length && !draft) return null;
  return (
    <div className="border-y bg-muted/40">
      {comments.map((c) =>
        draft?.id === c.id ? (
          <DiffCommentBox
            key={c.id}
            initial={c.text}
            onSave={(text) => onSave(c.id, text)}
            onCancel={onClose}
          />
        ) : (
          <DiffCommentCard
            key={c.id}
            comment={c}
            onEdit={() => onEdit(c)}
            onDelete={() => onDelete(c.id)}
          />
        ),
      )}
      {draft && draft.id === undefined && (
        <DiffCommentBox onSave={onAdd} onCancel={onClose} />
      )}
    </div>
  );
}
