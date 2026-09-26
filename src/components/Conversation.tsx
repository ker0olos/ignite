import { type RefObject, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  AssistantMessage,
  TextContent,
  ToolCall,
  ToolResult,
  UserMessage,
} from "../../shared/agentTypes";
import type { Item, ToolRun, Transcript } from "@/lib/transcript";
import { highlight } from "@/lib/highlight";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Editor = Settings["editor"];

/** The conversation so far, auto-scrolling unless the user has scrolled up. */
export function Conversation({
  transcript,
  folder,
  editor,
  codeThemes,
  scrollRef,
}: {
  transcript: Transcript;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const stuck = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  });

  const last = transcript.items.at(-1);
  const lastMessage =
    last?.kind === "message" ? (last.message as AssistantMessage) : null;
  const lastIsStreamingText =
    lastMessage?.role === "assistant" &&
    lastMessage.stopReason === "pending" &&
    lastMessage.content.at(-1)?.type === "text";

  return (
    <div className="always-bounce mx-auto max-w-3xl space-y-4 px-4 py-6 text-[13px]">
      {transcript.items.map((item, i) => (
        <ItemRow
          key={i}
          item={item}
          tools={transcript.tools}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      ))}
      {transcript.running && !lastIsStreamingText && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Working…
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  tools,
  folder,
  editor,
  codeThemes,
}: {
  item: Item;
  tools: Record<string, ToolRun>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  if (item.kind === "notice") {
    return (
      <p
        className={cn(
          "text-xs text-muted-foreground",
          item.error && "text-destructive",
        )}
      >
        {item.text}
      </p>
    );
  }
  const { message } = item;
  // `role` narrows only literal-role members; OtherMessage's role is a plain
  // string, so TS can't exclude it here even though it never matches.
  if (message.role === "user") {
    return <UserBubble message={message as UserMessage} />;
  }
  if (message.role === "assistant") {
    return (
      <AssistantBlock
        message={message as AssistantMessage}
        tools={tools}
        folder={folder}
        editor={editor}
        codeThemes={codeThemes}
      />
    );
  }
  return null;
}

function UserBubble({ message }: { message: UserMessage }) {
  const text =
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n");
  if (!text) return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBlock({
  message,
  tools,
  folder,
  editor,
  codeThemes,
}: {
  message: AssistantMessage;
  tools: Record<string, ToolRun>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  return (
    <div className="space-y-2">
      {message.content.map((block, i) => {
        if (block.type === "text") {
          return block.text ? (
            <AssistantText
              key={i}
              text={block.text}
              editor={editor}
              codeThemes={codeThemes}
            />
          ) : null;
        }
        if (block.type === "thinking") {
          if (!block.thinking && block.redacted) return null;
          return <ThinkingRow key={i} thinking={block.thinking} />;
        }
        return (
          <ToolRow key={i} call={block} run={tools[block.id]} folder={folder} />
        );
      })}
      {message.stopReason === "error" && (
        <p className="text-[13px] text-destructive">{message.errorMessage}</p>
      )}
      {message.stopReason === "aborted" && (
        <p className="text-xs text-muted-foreground">Stopped</p>
      )}
    </div>
  );
}

function ThinkingRow({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", open && "rotate-90")}
        />
        Thinking
      </button>
      {open && (
        <p className="mt-1 pl-4 text-xs whitespace-pre-wrap text-muted-foreground">
          {thinking}
        </p>
      )}
    </div>
  );
}

function AssistantText({
  text,
  editor,
  codeThemes,
}: {
  text: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  const components: Components = {
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary underline-offset-2 hover:underline"
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
      {text}
    </ReactMarkdown>
  );
}

function CodeBlock({
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

/** Path relative to the open folder when it's inside it, else as given. */
function relativePath(path: string, folder: string) {
  return path.startsWith(folder + "/") ? path.slice(folder.length + 1) : path;
}

function resultText(result: ToolResult | undefined) {
  if (!result) return "";
  return result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

const MAX_INLINE_CHARS = 4000;

function truncate(text: string) {
  return text.length > MAX_INLINE_CHARS
    ? text.slice(0, MAX_INLINE_CHARS) + "\n…"
    : text;
}

function ToolRow({
  call,
  run,
  folder,
}: {
  call: ToolCall;
  run: ToolRun | undefined;
  folder: string;
}) {
  const [open, setOpen] = useState(false);
  const path = String(call.arguments.path ?? "");

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left"
      >
        <StatusIcon run={run} />
        <span className="min-w-0 flex-1 truncate">
          {call.name === "read" && (
            <>
              Read <PathText path={path} folder={folder} />
            </>
          )}
          {call.name === "write" && (
            <>
              Wrote <PathText path={path} folder={folder} />
            </>
          )}
          {call.name === "edit" && (
            <>
              Edited <PathText path={path} folder={folder} />
            </>
          )}
          {call.name === "bash" && (
            <>
              Ran{" "}
              <code className="font-mono text-[12px]">
                {String(call.arguments.command ?? "")}
              </code>
            </>
          )}
          {!["read", "write", "edit", "bash"].includes(call.name) && call.name}
        </span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && <ToolDetail call={call} run={run} />}
    </div>
  );
}

function PathText({ path, folder }: { path: string; folder: string }) {
  return (
    <span className="font-mono text-[12px]">{relativePath(path, folder)}</span>
  );
}

function StatusIcon({ run }: { run: ToolRun | undefined }) {
  if (!run || run.status === "running") {
    return (
      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
  }
  if (run.status === "error") {
    return <X className="size-3.5 shrink-0 text-destructive" />;
  }
  return <Check className="size-3.5 shrink-0 text-muted-foreground" />;
}

function ToolDetail({
  call,
  run,
}: {
  call: ToolCall;
  run: ToolRun | undefined;
}) {
  const text = resultText(run?.result);

  if (run?.status === "error") {
    return (
      <p className="border-t px-2 py-1.5 text-[12px] whitespace-pre-wrap text-destructive">
        {text || "Failed."}
      </p>
    );
  }

  if (call.name === "edit") {
    const diff = (run?.result?.details as { diff?: string } | undefined)?.diff;
    return diff ? (
      <DiffView diff={diff} />
    ) : (
      <pre className="max-h-64 overflow-auto border-t px-2 py-1.5 font-mono text-[12px] whitespace-pre-wrap">
        {text}
      </pre>
    );
  }

  if (call.name === "write") {
    return (
      <pre className="max-h-64 overflow-auto border-t px-2 py-1.5 font-mono text-[12px] whitespace-pre-wrap">
        {truncate(String(call.arguments.content ?? ""))}
      </pre>
    );
  }

  if (call.name === "bash" || call.name === "read") {
    return (
      <pre className="max-h-64 overflow-auto border-t px-2 py-1.5 font-mono text-[12px] whitespace-pre-wrap">
        {text}
      </pre>
    );
  }

  return (
    <pre className="max-h-64 overflow-auto border-t px-2 py-1.5 font-mono text-[12px] whitespace-pre-wrap">
      {JSON.stringify(call.arguments, null, 2)}
    </pre>
  );
}

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="max-h-64 overflow-auto border-t px-2 py-1.5 font-mono text-[12px]">
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            line.startsWith("+") && "text-success",
            line.startsWith("-") && "text-destructive",
          )}
        >
          {line}
        </div>
      ))}
    </pre>
  );
}
