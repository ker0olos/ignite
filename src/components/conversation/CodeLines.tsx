import { useEffect, useState } from "react";
import { MoreLines } from "@/components/conversation/MoreLines";
import type { Editor } from "@/components/conversation/shared";
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
}: {
  lines: DiffLine[];
  path: string;
  max: number;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const [all, setAll] = useState(false);
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
        className="tool-code overflow-x-auto rounded-md border py-1 text-[12px] leading-[18px] text-foreground"
        style={{ fontFamily: editor.font_family }}
      >
        {shown.map((line, i) =>
          line.kind === "gap" ? (
            <div key={i} className="pl-12 text-muted-foreground select-none">
              ⋯
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "flex min-w-fit",
                line.kind === "add" && "bg-success/15",
                line.kind === "del" && "bg-destructive/15",
              )}
            >
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
                {tokens?.[i]
                  ? tokens[i].map((t, j) => (
                      <span key={j} className="tok" style={t.style}>
                        {t.content}
                      </span>
                    ))
                  : line.text}
              </span>
            </div>
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
