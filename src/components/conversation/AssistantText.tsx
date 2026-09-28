import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/conversation/CodeBlock";
import type { Editor } from "@/components/conversation/shared";
import { useSmoothText } from "@/hooks/useSmoothText";
import type { CodeThemes } from "@/lib/codeThemes";

/** Assistant markdown text, with fenced code blocks syntax-highlighted. */
export function AssistantText({
  text,
  editor,
  codeThemes,
}: {
  text: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const shown = useSmoothText(text);
  const components: Components = {
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary underline decoration-current/40 underline-offset-2 hover:decoration-current"
        onClick={(e) => {
          e.preventDefault();
          if (href) openUrl(href).catch(() => {});
        }}
      >
        {children}
      </a>
    ),
    h1: ({ children }) => (
      <h1 className="mt-4 mb-2 text-base font-semibold first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-2 text-[13px] font-semibold first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1.5 text-[13px] font-semibold first:mt-0">
        {children}
      </h3>
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
        <CodeBlock
          code={code}
          lang={match?.[1]}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    },
    code: ({ children }) => (
      <code className="rounded bg-muted px-1 font-mono text-[12px]">
        {children}
      </code>
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {shown}
    </ReactMarkdown>
  );
}
