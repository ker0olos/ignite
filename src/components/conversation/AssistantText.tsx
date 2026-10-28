import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { InlineCode } from "@/components/conversation/InlineCode";
import { LinkPill } from "@/components/conversation/LinkPill";
import { MarkdownCodeBlock } from "@/components/conversation/MarkdownCodeBlock";
import { QuoteBlock } from "@/components/conversation/QuoteBlock";
import type { Editor } from "@/components/conversation/shared";
import { useOpenFileLink } from "@/hooks/useOpenTab";
import { useSmoothText } from "@/hooks/useSmoothText";
import type { CodeThemes } from "@/lib/codeThemes";
import { looksLikeFilePath } from "@/lib/fileLinks";
import { MarkdownSource } from "@/lib/quote";

/** Assistant markdown text, with fenced code blocks syntax-highlighted. */
export function AssistantText({
  text,
  folder,
  editor,
  codeThemes,
}: {
  text: string;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const shown = useSmoothText(text);
  const openFileLink = useOpenFileLink(folder);
  // The same components every render: new ones would remount the message, and with it lose the user's selection.
  const components = useMemo(
    () => markdownComponents(folder, openFileLink, editor, codeThemes),
    [folder, openFileLink, editor, codeThemes],
  );

  return (
    <div className="text-[length:var(--message-text,14px)]">
      <MarkdownSource.Provider value={shown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {shown}
        </ReactMarkdown>
      </MarkdownSource.Provider>
    </div>
  );
}

function markdownComponents(
  folder: string,
  openFileLink: (text: string) => void,
  editor: Editor,
  codeThemes: CodeThemes,
): Components {
  return {
    a: ({ href = "", children }) => {
      const file = looksLikeFilePath(href);
      return (
        <LinkPill
          kind={file ? "file" : "url"}
          onOpen={() => {
            if (!href) return;
            if (file) openFileLink(href);
            else openUrl(href).catch(() => {});
          }}
        >
          {children}
        </LinkPill>
      );
    },
    h1: ({ children }) => (
      <h1 className="mt-4 mb-2 text-[1.2em] font-semibold first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1.5 font-semibold first:mt-0">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
    ),
    blockquote: ({ node, children }) => (
      <QuoteBlock
        start={node?.position?.start.offset}
        end={node?.position?.end.offset}
      >
        {children}
      </QuoteBlock>
    ),
    table: ({ children }) => (
      <div className="mb-2 overflow-x-auto last:mb-0">
        <table className="w-full border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b px-2 py-1 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const codeProps =
        child && typeof child === "object" && "props" in child
          ? (child.props as { className?: string; children?: unknown })
          : {};
      const match = /language-(\w+)/.exec(codeProps.className ?? "");
      const code = String(codeProps.children ?? "").replace(/\n$/, "");
      return (
        <MarkdownCodeBlock
          code={code}
          fenceLang={match?.[1]}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    },
    code: ({ children }) => (
      <InlineCode
        text={String(children ?? "")}
        folder={folder}
        onOpen={openFileLink}
      >
        {children}
      </InlineCode>
    ),
  };
}
