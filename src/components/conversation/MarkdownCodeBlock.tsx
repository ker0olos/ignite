import { CodeBlock } from "@/components/conversation/CodeBlock";
import { CodeBlockActions } from "@/components/conversation/CodeBlockActions";
import type { Editor } from "@/components/conversation/shared";
import { useBlockLang } from "@/hooks/useBlockLang";
import type { CodeThemes } from "@/lib/codeThemes";

/** A fenced code block in assistant text, with Copy and (for shell) Run on hover. */
export function MarkdownCodeBlock({
  code,
  fenceLang,
  editor,
  codeThemes,
}: {
  code: string;
  fenceLang: string | undefined;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const lang = useBlockLang(fenceLang, code);
  return (
    <div className="group relative">
      {/* Tall enough for its buttons on one line. */}
      <CodeBlock
        code={code}
        lang={lang}
        editor={editor}
        codeThemes={codeThemes}
        className="[&_pre]:py-1.5"
      />
      <CodeBlockActions code={code} lang={lang} />
    </div>
  );
}
