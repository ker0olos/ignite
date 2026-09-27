import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, Loader2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  AssistantMessage,
  ImageContent,
  TextContent,
  ToolCall,
  ToolResult,
  UserMessage,
} from "../../shared/agentTypes";
import type { ToolRun, Transcript } from "@/lib/transcript";
import { highlight, highlightLines, type Token } from "@/lib/highlight";
import {
  diffSummary,
  groupSummary,
  parseDiff,
  toRows,
  type DiffLine,
  type Row,
} from "@/lib/toolRows";
import { mcpCall, type McpCall } from "@/lib/mcpToolCall";
import { imageUrl } from "@/lib/images";
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
  showThinking,
  scrollRef,
}: {
  transcript: Transcript;
  showThinking: boolean;
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
      {toRows(transcript.items, showThinking).map((row, i) => (
        <RowView
          key={i}
          row={row}
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

function RowView({
  row,
  tools,
  folder,
  editor,
  codeThemes,
}: {
  row: Row;
  tools: Record<string, ToolRun>;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
}) {
  switch (row.kind) {
    case "notice":
      return (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            row.error && "text-destructive",
          )}
        >
          {row.text}
        </p>
      );
    case "user":
      return <UserBubble message={row.message} />;
    case "text":
      return (
        <AssistantText
          text={row.text}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    case "thinking":
      return <ThinkingRow thinking={row.thinking} />;
    case "tool":
      return (
        <ToolView
          call={row.call}
          run={tools[row.call.id]}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    case "group":
      return (
        <ToolGroup
          calls={row.calls}
          tools={tools}
          folder={folder}
          editor={editor}
          codeThemes={codeThemes}
        />
      );
    case "end":
      return row.message.stopReason === "error" ? (
        <p className="text-[13px] text-destructive">
          {row.message.errorMessage}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Stopped</p>
      );
  }
}

function UserBubble({ message }: { message: UserMessage }) {
  const text =
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n");
  const images =
    typeof message.content === "string"
      ? []
      : message.content.filter((b): b is ImageContent => b.type === "image");
  if (!text && !images.length) return null;
  return (
    <div className="flex flex-col items-end gap-2">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {images.map((image, i) => (
            <img
              key={i}
              src={imageUrl(image)}
              alt=""
              className="max-h-40 max-w-60 rounded-lg border object-contain"
            />
          ))}
        </div>
      )}
      {text && (
        <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap">
          {text}
        </div>
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

const TOOL_TITLES: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Update",
  bash: "Bash",
  grep: "Search",
  find: "Find",
  ls: "List",
};

// Lines shown before "… +N lines"; clicking it shows the rest.
const PREVIEW_LINES = 5;
const CODE_PREVIEW_LINES = 12;
const DIFF_PREVIEW_LINES = 40;

function toolArg(call: ToolCall, folder: string) {
  const arg = (key: string) => String(call.arguments[key] ?? "");
  switch (call.name) {
    case "read":
    case "write":
    case "edit":
      return relativePath(arg("path"), folder);
    case "ls":
      return relativePath(arg("path"), folder) || ".";
    case "bash":
      return arg("command");
    case "grep":
    case "find":
      return arg("pattern");
    default:
      return "";
  }
}

type ToolProps = {
  call: ToolCall;
  run: ToolRun | undefined;
  folder: string;
  editor: Editor;
  codeThemes: CodeThemes;
};

/** One tool call: `● Update(path)` with its outcome underneath, as Claude Code draws it. */
function ToolView({ call, run, folder, editor, codeThemes }: ToolProps) {
  const mcp = mcpCall(call.name, call.arguments);
  const text = resultText(run?.result);
  return (
    <div className="space-y-1">
      <ToolHead
        run={run}
        title={
          mcp ? (
            <McpCallLabel call={mcp} />
          ) : (
            (TOOL_TITLES[call.name] ?? call.name)
          )
        }
        arg={mcp ? "" : toolArg(call, folder)}
      />
      {run?.status === "error" ? (
        <ToolOutcome>
          <OutputPreview text={text || "Failed."} error />
        </ToolOutcome>
      ) : (
        run && (
          <ToolOutcome>
            <ToolBody
              call={call}
              run={run}
              text={text}
              editor={editor}
              codeThemes={codeThemes}
            />
          </ToolOutcome>
        )
      )}
    </div>
  );
}

function ToolBody({
  call,
  run,
  text,
  editor,
  codeThemes,
}: Omit<ToolProps, "folder" | "run"> & { run: ToolRun; text: string }) {
  const path = String(call.arguments.path ?? "");
  const running = run.status === "running";

  if (call.name === "edit") {
    const diff = (run.result?.details as { diff?: string } | undefined)?.diff;
    if (!diff) return running ? null : <OutputPreview text={text} />;
    const lines = parseDiff(diff);
    return (
      <>
        <p>{diffSummary(lines)}</p>
        <CodeLines
          lines={lines}
          path={path}
          max={DIFF_PREVIEW_LINES}
          editor={editor}
          codeThemes={codeThemes}
        />
      </>
    );
  }

  if (call.name === "write") {
    const content = String(call.arguments.content ?? "").replace(/\n$/, "");
    const lines: DiffLine[] = content
      .split("\n")
      .map((text, i) => ({ kind: "ctx", num: i + 1, text }));
    return (
      <>
        <p>
          {running ? "Writing" : "Wrote"}{" "}
          <span className="font-medium text-foreground">{lines.length}</span>{" "}
          {lines.length === 1 ? "line" : "lines"}
        </p>
        <CodeLines
          lines={lines}
          path={path}
          max={CODE_PREVIEW_LINES}
          editor={editor}
          codeThemes={codeThemes}
        />
      </>
    );
  }

  if (call.name === "read") {
    if (running) return null;
    const count = text ? text.split("\n").length : 0;
    return (
      <p>
        Read <span className="font-medium text-foreground">{count}</span>{" "}
        {count === 1 ? "line" : "lines"}
      </p>
    );
  }

  if (!text) return running ? null : <p>(No output)</p>;
  return <OutputPreview text={text} />;
}

function ToolHead({
  run,
  title,
  arg,
}: {
  run: ToolRun | undefined;
  title: ReactNode;
  arg: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusDot run={run} />
      <span className="min-w-0 truncate">
        <span className="font-semibold">{title}</span>
        {arg && (
          <span className="font-mono text-[12px] text-muted-foreground">
            ({arg})
          </span>
        )}
      </span>
    </div>
  );
}

function ToolOutcome({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 pl-0.5 text-muted-foreground">
      <span className="select-none">⎿</span>
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  );
}

function StatusDot({ run }: { run: ToolRun | undefined }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        !run || run.status === "running"
          ? "animate-pulse bg-muted-foreground"
          : run.status === "error"
            ? "bg-destructive"
            : "bg-success",
      )}
    />
  );
}

/** Consecutive reads, searches and shell commands, folded into one line. */
function ToolGroup({
  calls,
  tools,
  ...rest
}: Omit<ToolProps, "call" | "run"> & {
  calls: ToolCall[];
  tools: Record<string, ToolRun>;
}) {
  const [open, setOpen] = useState(false);
  const runs = calls.map((c) => tools[c.id]);
  const running = runs.some((r) => !r || r.status === "running");
  const failed = runs.some((r) => r?.status === "error");
  const status: ToolRun | undefined = running
    ? undefined
    : { status: failed ? "error" : "done" };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <StatusDot run={status} />
        {groupSummary(calls)}
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="space-y-2 border-l pl-3">
          {calls.map((call) => (
            <ToolView
              key={call.id}
              call={call}
              run={tools[call.id]}
              {...rest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function McpCallLabel({ call }: { call: McpCall }) {
  const mono = (text: string) => (
    <code className="font-mono text-[12px] font-normal">{text}</code>
  );
  switch (call.kind) {
    case "call":
      return (
        <>
          {call.server && (
            <span className="font-normal text-muted-foreground">
              {call.server} ·{" "}
            </span>
          )}
          {mono(call.tool)}
        </>
      );
    case "search":
      return <>Searched MCP tools for “{call.query}”</>;
    case "describe":
      return <>Looked up {mono(call.tool)}</>;
    case "connect":
      return <>Connected to {call.server}</>;
    case "script":
      return <>Ran an MCP script</>;
    case "other":
      return <>Checked MCP servers</>;
  }
}

function MoreLines({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      … +{count} {count === 1 ? "line" : "lines"}
    </button>
  );
}

function OutputPreview({ text, error }: { text: string; error?: boolean }) {
  const [all, setAll] = useState(false);
  const lines = text.replace(/\n+$/, "").split("\n");
  const shown = all ? lines : lines.slice(0, PREVIEW_LINES);
  return (
    <div>
      <pre
        className={cn(
          "font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]",
          error && "text-destructive",
        )}
      >
        {shown.join("\n")}
      </pre>
      {lines.length > shown.length && (
        <MoreLines
          count={lines.length - shown.length}
          onClick={() => setAll(true)}
        />
      )}
    </div>
  );
}

/** Highlighted lines with numbers; added and removed lines are tinted. */
function CodeLines({
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
