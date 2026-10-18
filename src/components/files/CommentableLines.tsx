import type { MouseEvent } from "react";
import { CodeLines } from "@/components/conversation/CodeLines";
import type { RowExtras } from "@/components/conversation/shared";
import { DiffCommentButton } from "@/components/files/DiffCommentButton";
import { DiffRowComments } from "@/components/files/DiffRowComments";
import { useCommentSelection } from "@/hooks/useCommentSelection";
import type { useDiffComments } from "@/hooks/useDiffComments";
import type { CodeThemes } from "@/lib/codeThemes";
import { placeComment } from "@/lib/diffCommentMessage";
import type { Settings } from "@/lib/settings";
import type { DiffLine } from "@/lib/toolRows";

/** A diff tab's lines, each with a comment button, its comments under the lines they quote. */
export function CommentableLines({
  lines,
  path,
  comments,
  editor,
  themes,
}: {
  lines: DiffLine[];
  path: string;
  comments: ReturnType<typeof useDiffComments>;
  editor: Settings["editor"];
  themes: CodeThemes;
}) {
  const selection = useCommentSelection();
  const { draft } = selection;
  const placed = comments.comments.flatMap((c) => placeComment(lines, c) ?? []);
  const extras: RowExtras = {
    gutter: (row) => (
      <DiffCommentButton
        onPress={(shift) => selection.press(row, shift)}
        onOpen={() => selection.open(row)}
      />
    ),
    below: (row) => (
      <DiffRowComments
        comments={placed.filter((c) => c.to === row)}
        draft={draft?.to === row ? draft : null}
        onAdd={(text) => {
          if (draft) comments.add(lines, draft.from, draft.to, text);
          selection.close();
        }}
        onEdit={(c) => selection.edit({ from: c.from, to: c.to, id: c.id })}
        onSave={(id, text) => {
          comments.edit(id, text);
          selection.close();
        }}
        onDelete={comments.remove}
        onClose={selection.close}
      />
    ),
    selected: selection.selected,
    keep: (row) => draft?.to === row || placed.some((c) => c.to === row),
  };
  // A drag over the lines extends the range to the row under the pointer.
  const onMouseMove = (e: MouseEvent) => {
    const row = (e.target as Element).closest("[data-row]");
    if (row) selection.hover(Number(row.getAttribute("data-row")));
  };
  return (
    <div onMouseMove={onMouseMove}>
      <CodeLines
        lines={lines}
        path={path}
        max={Infinity}
        editor={editor}
        codeThemes={themes}
        className="rounded-none border-0"
        extras={extras}
      />
    </div>
  );
}
