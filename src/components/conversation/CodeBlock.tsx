import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;
    highlight(code, lang ? `snippet.${lang}` : "snippet.txt", codeThemes).then(
      (h) => !cancelled && setHtml(h),
    );
    return () => {
      cancelled = true;
    };
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
