import { useEffect, useRef, useState } from "react";
import type { Editor } from "@/components/conversation/shared";
import { highlight } from "@/lib/highlight";
import type { CodeThemes } from "@/lib/codeThemes";

/** One fenced code block from assistant markdown, highlighted with Shiki. */
export function CodeBlock({
  code,
  lang,
  editor,
  codeThemes,
}: {
  code: string;
  lang: string | undefined;
  editor: Editor;
  codeThemes: CodeThemes;
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
    <div
      className="code-view my-2 overflow-x-auto rounded-lg border"
      style={{ fontFamily: editor.font_family }}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="p-3 font-mono text-[12px] whitespace-pre-wrap">
          {code}
        </pre>
      )}
    </div>
  );
}
