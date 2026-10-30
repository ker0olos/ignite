import { Fragment, useEffect, useState } from "react";
import { CodeLine } from "@/components/conversation/CodeLine";
import { FoldedLines } from "@/components/conversation/FoldedLines";
import { MoreLines } from "@/components/conversation/MoreLines";
import type { Editor, RowExtras } from "@/components/conversation/shared";
import { foldUnchanged, keepUnfolded } from "@/lib/gitDiff";
import { highlightDiff, type Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/toolRows";
import type { CodeThemes } from "@/lib/codeThemes";
import { cn } from "@/lib/utils";
import { changedRanges } from "@/lib/wordDiff";

/** Highlighted lines with numbers; added and removed lines are tinted. */
export function CodeLines({
  lines,
  path,
  max,
  editor,
  codeThemes,
  className,
  extras,
}: {
  lines: DiffLine[];
  path: string;
  max: number;
  editor: Editor;
  codeThemes: CodeThemes;
  className?: string;
  extras?: RowExtras;
}) {
  const [all, setAll] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [highlighted, setHighlighted] = useState<{
    key: string;
    tokens: (Token[] | undefined)[];
  } | null>(null);
  // Callers parse their lines afresh each render, so the lines' content is what's compared.
  const key = JSON.stringify(lines);
  const tokens = highlighted?.key === key ? highlighted.tokens : null;
  const marks = lines.some((l) => l.kind === "add" || l.kind === "del");
  const shown = all ? lines : lines.slice(0, max);
  const changed = changedRanges(shown);
  const folded = foldUnchanged(shown, expanded);
  const rows = extras ? keepUnfolded(folded, extras.keep) : folded;

  useEffect(() => {
    let cancelled = false;
    highlightDiff(lines, path, codeThemes).then(
      (t) => !cancelled && setHighlighted({ key, tokens: t }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, path, codeThemes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div
        className={cn(
          "tool-code overflow-x-auto rounded-md border py-1 text-[12px] leading-[18px] text-foreground",
          className,
        )}
        style={{ fontFamily: editor.font_family }}
      >
        {rows.map((row) =>
          "from" in row ? (
            <FoldedLines
              key={`fold-${row.from}`}
              count={row.to - row.from}
              onExpand={() => setExpanded((s) => new Set(s).add(row.from))}
            />
          ) : (
            <Fragment key={row.index}>
              <CodeLine
                line={shown[row.index]}
                row={row.index}
                tokens={tokens?.[row.index]}
                marks={marks}
                editor={editor}
                gutter={extras?.gutter(row.index)}
                selected={extras?.selected(row.index)}
                changed={changed.get(row.index)}
              />
              {extras?.below(row.index)}
            </Fragment>
          ),
        )}
      </div>
      {lines.length > shown.length && (
        <MoreLines
          count={lines.length - shown.length}
          onClick={() => setAll(true)}
        />
      )}
    </div>
  );
}
