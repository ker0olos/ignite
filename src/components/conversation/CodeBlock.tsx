import { useEffect, useRef, useState } from "react";
import type { Editor } from "@/components/conversation/shared";
import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/utils";
import type { CodeThemes } from "@/lib/codeThemes";

/** A code block, highlighted with Shiki: assistant markdown, or a command awaiting approval. */
export function CodeBlock({
  code,
  lang,
  editor,
  codeThemes,
  className,
}: {
  code: string;
  lang: string | undefined;
  editor: Editor;
  codeThemes: CodeThemes;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const requested = useRef(0);
  const landed = useRef(0);

  // While code streams in, show each newer result instead of cancelling every
  // one but the last, which would leave it unhighlighted until the stream ends.
  useEffect(() => {
    const n = ++requested.current;
    highlight(code, lang ? `snippet.${lang}` : "snippet.txt", codeThemes).then(
      (h) => {
        if (n < landed.current) return;
        landed.current = n;
        setHtml(h);
      },
    );
  }, [code, lang, codeThemes]);

  return (
    // w-max keeps the right padding inside the scrolled width.
    <div
      className={cn(
        "code-view my-2 overflow-x-auto rounded-lg border [&_pre]:w-max [&_pre]:min-w-full [&_pre]:pr-4",
        className,
      )}
      style={{ fontFamily: editor.font_family, fontSize: "0.92em" }}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        // Laid out like Shiki's output, so highlighting doesn't move the page.
        <pre className="shiki">
          <code>
            {code.split("\n").map((line, i) => (
              <span key={i} className="line">
                {line}
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}
