import { useEffect, useState } from "react";

/** Rows `from` to `to`, `to` the last; `id` when editing a saved comment. */
export type CommentDraft = { from: number; to: number; id?: number };

const ordered = (a: number, b: number) => ({
  from: Math.min(a, b),
  to: Math.max(a, b),
});

/**
 * The rows a new comment takes: pressing a row's comment button and dragging
 * takes a range, shift-pressing takes the range from the last pressed row; the comment box open.
 */
export function useCommentSelection() {
  const [anchor, setAnchor] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [draft, setDraft] = useState<CommentDraft | null>(null);

  useEffect(() => {
    if (!drag) return;
    const up = () => {
      setDraft(ordered(drag.from, drag.to));
      setDrag(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [drag]);

  const range: CommentDraft | null = drag ? ordered(drag.from, drag.to) : draft;
  return {
    draft,
    /** A row's comment button pressed; with shift, from the last pressed row. */
    press: (row: number, shift: boolean) => {
      if (shift && anchor !== null) {
        setDraft(ordered(anchor, row));
        return;
      }
      setAnchor(row);
      setDrag({ from: row, to: row });
    },
    /** The pointer over `row`, which a drag extends to. */
    hover: (row: number) => setDrag((d) => d && { ...d, to: row }),
    /** Opens the box for one row, as the keyboard does. */
    open: (row: number) => {
      setAnchor(row);
      setDraft({ from: row, to: row });
    },
    edit: (comment: Required<CommentDraft>) => setDraft(comment),
    close: () => setDraft(null),
    /** Whether `row` is in the range being taken (not a saved comment's being edited). */
    selected: (row: number) =>
      !!range && range.id === undefined && row >= range.from && row <= range.to,
  };
}
