import type { ReactNode } from "react";
import type { Editor } from "@/components/conversation/shared";
import type { Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** One numbered line of CodeLines, tinted when added or removed; a diff tab's has a gutter (its comment button) and shows selected. */
export function CodeLine({
  line,
  row,
  tokens,
  marks,
  editor,
  gutter,
  selected,
}: {
  line: DiffLine;
  row: number;
  tokens: Token[] | undefined;
  marks: boolean;
  editor: Editor;
  gutter?: ReactNode;
  selected?: boolean;
}) {
  if (line.kind === "gap")
    return (
      <div data-row={row} className="pl-12 text-muted-foreground select-none">
        ⋯
      </div>
    );

  return (
    <div
      data-row={row}
      className={cn(
        "group/line flex min-w-fit",
        line.kind === "add" && "bg-success/15",
        line.kind === "del" && "bg-destructive/15",
        selected && "bg-primary/15",
      )}
    >
      {gutter}
      <span className="w-10 shrink-0 pr-2 text-right text-muted-foreground select-none">
        {line.num}
      </span>
      {marks && (
        <span className="w-4 shrink-0 text-muted-foreground select-none">
          {line.kind === "add" ? "+" : line.kind === "del" ? "-" : ""}
        </span>
      )}
      <span
        className={cn(
          "pr-3",
          editor.word_wrap
            ? "min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]"
            : "whitespace-pre",
        )}
      >
        {tokens
          ? tokens.map((t, j) => (
              <span key={j} className="tok" style={t.style}>
                {t.content}
              </span>
            ))
          : line.text}
      </span>
    </div>
  );
}
