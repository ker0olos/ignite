import { useEffect, useState } from "react";
import { CodeLine } from "@/components/conversation/CodeLine";
import { FoldedLines } from "@/components/conversation/FoldedLines";
import { MoreLines } from "@/components/conversation/MoreLines";
import type { Editor } from "@/components/conversation/shared";
import { foldUnchanged } from "@/lib/gitDiff";
import { highlightLines, type Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/toolRows";
import type { CodeThemes } from "@/lib/codeThemes";
import { cn } from "@/lib/utils";

/** Highlighted lines with numbers; added and removed lines are tinted. */
export function CodeLines({
  lines,
  path,
  max,
  editor,
  codeThemes,
  className,
}: {
  lines: DiffLine[];
  path: string;
  max: number;
  editor: Editor;
  codeThemes: CodeThemes;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  const code = lines.map((l) => (l.kind === "gap" ? "" : l.text)).join("\n");
  const marks = lines.some((l) => l.kind === "add" || l.kind === "del");
  const shown = all ? lines : lines.slice(0, max);

  useEffect(() => {
    let cancelled = false;
    highlightLines(code, path, codeThemes).then(
      (t) => !cancelled && setTokens(t),
    );
    return () => {
      cancelled = true;
    };
  }, [code, path, codeThemes]);

  return (
    <div>
      <div
        className={cn(
          "tool-code overflow-x-auto rounded-md border py-1 text-[12px] leading-[18px] text-foreground",
          className,
        )}
        style={{ fontFamily: editor.font_family }}
      >
        {foldUnchanged(shown, expanded).map((row) =>
          "from" in row ? (
            <FoldedLines
              key={`fold-${row.from}`}
              count={row.to - row.from}
              onExpand={() => setExpanded((s) => new Set(s).add(row.from))}
            />
          ) : (
            <CodeLine
              key={row.index}
              line={shown[row.index]}
              row={row.index}
              tokens={tokens?.[row.index]}
              marks={marks}
              editor={editor}
            />
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
