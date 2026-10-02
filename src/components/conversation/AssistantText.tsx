import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/conversation/CodeBlock";
import type { Editor } from "@/components/conversation/shared";
import { useOpenTab } from "@/hooks/useOpenTab";
import { useSmoothText } from "@/hooks/useSmoothText";
import type { CodeThemes } from "@/lib/codeThemes";
import {
  filePathTarget,
  isInsideFolder,
  looksLikeFilePath,
} from "@/lib/fileLinks";

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
  const openTab = useOpenTab();
  const openFileLink = (text: string) => {
    const path = filePathTarget(folder, text);
    if (isInsideFolder(folder, path)) openTab(path);
    else openPath(path).catch(() => {});
  };
  const components: Components = {
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary underline decoration-current/40 underline-offset-2 hover:decoration-current"
        onClick={(e) => {
          e.preventDefault();
          if (!href) return;
          if (looksLikeFilePath(href)) openFileLink(href);
          else openUrl(href).catch(() => {});
        }}
      >
        {children}
      </a>
    ),
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
    code: ({ children }) => {
      const text = String(children ?? "");
      if (!looksLikeFilePath(text)) {
        return (
          <code className="rounded bg-muted px-1 font-mono text-[0.92em]">
            {children}
          </code>
        );
      }
      return (
        <button
          type="button"
          className="rounded bg-muted px-1 font-mono text-[0.92em] underline decoration-current/40 underline-offset-2 hover:decoration-current"
          onClick={() => openFileLink(text)}
        >
          {children}
        </button>
      );
    },
  };

  return (
    <div className="text-[length:var(--message-text,14px)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {shown}
      </ReactMarkdown>
    </div>
  );
}
