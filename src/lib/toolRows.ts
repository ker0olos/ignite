import type {
  AssistantMessage,
  ToolCall,
  UserMessage,
} from "../../shared/agentTypes";
import type { Item, ToolRun } from "./transcript";

/** One row of the conversation as drawn, with quiet tool calls folded together. */
export type Row =
  | Extract<Item, { kind: "notice" }>
  | { kind: "user"; message: UserMessage }
  | { kind: "text"; text: string }
  | { kind: "thinking"; thinking: string }
  | { kind: "tool"; call: ToolCall }
  | { kind: "group"; calls: ToolCall[] }
  | { kind: "end"; message: AssistantMessage };

// Look-around tools that fold into one summary line, as in Claude Code.
const QUIET = new Set(["read", "grep", "find", "ls", "bash"]);

type Block = AssistantMessage["content"][number];

/**
 * Folds a quiet call into the group before it. A failed call stands alone, so
 * a red row always means that call.
 */
function pushCall(rows: Row[], call: ToolCall, tools: Record<string, ToolRun>) {
  if (!QUIET.has(call.name) || tools[call.id]?.status === "error") {
    rows.push({ kind: "tool", call });
    return;
  }
  const last = rows.at(-1);
  if (last?.kind === "group") last.calls.push(call);
  else rows.push({ kind: "group", calls: [call] });
}

/** Adds one assistant content block to `rows`. */
function pushBlock(
  rows: Row[],
  block: Block,
  showThinking: boolean,
  tools: Record<string, ToolRun>,
) {
  if (block.type === "text") {
    if (block.text) rows.push({ kind: "text", text: block.text });
  } else if (block.type === "thinking") {
    if (showThinking && (block.thinking || !block.redacted)) {
      rows.push({ kind: "thinking", thinking: block.thinking });
    }
  } else {
    pushCall(rows, block, tools);
  }
}

const isEndOfRun = (assistant: AssistantMessage) =>
  assistant.stopReason === "error" || assistant.stopReason === "aborted";

// Folding one call saves no space and hides what it ran.
const unfoldSingle = (row: Row): Row =>
  row.kind === "group" && row.calls.length === 1
    ? { kind: "tool", call: row.calls[0] }
    : row;

/** Flattens the transcript into rows, folding two or more consecutive quiet tool calls that didn't fail. */
export function toRows(
  items: Item[],
  showThinking = false,
  tools: Record<string, ToolRun> = {},
): Row[] {
  const rows: Row[] = [];
  for (const item of items) {
    if (item.kind === "notice") {
      rows.push(item);
      continue;
    }
    const { message } = item;
    if (message.role === "user") {
      rows.push({ kind: "user", message: message as UserMessage });
    }
    if (message.role !== "assistant") continue;
    const assistant = message as AssistantMessage;
    for (const block of assistant.content) {
      pushBlock(rows, block, showThinking, tools);
    }
    if (isEndOfRun(assistant)) {
      rows.push({ kind: "end", message: assistant });
    }
  }
  return rows.map(unfoldSingle);
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "Read 2 files, ran 1 shell command" for a folded group. */
export function groupSummary(calls: ToolCall[]) {
  const count = (...names: string[]) =>
    calls.filter((c) => names.includes(c.name)).length;
  const parts = [
    [count("read"), "read", "file", "files"],
    [count("grep", "find"), "searched for", "pattern", "patterns"],
    [count("ls"), "listed", "folder", "folders"],
    [count("bash"), "ran", "shell command", "shell commands"],
  ] as const;
  const text = parts
    .filter(([n]) => n > 0)
    .map(([n, verb, one, many]) => `${verb} ${plural(n, one, many)}`)
    .join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type DiffLine =
  { kind: "add" | "del" | "ctx"; num: number; text: string } | { kind: "gap" };

/** Parses pi's edit diff: `+12 text`, `-12 text`, ` 12 text`, and `  ...` gaps. */
export function parseDiff(diff: string): DiffLine[] {
  return diff.split("\n").map((line) => {
    const m = /^([+\- ])\s*(\d+) (.*)$/.exec(line);
    if (!m) return { kind: "gap" };
    const kind = m[1] === "+" ? "add" : m[1] === "-" ? "del" : "ctx";
    return { kind, num: Number(m[2]), text: m[3] };
  });
}

/** "Added 7 lines, removed 1 line" for a parsed diff. */
export function diffSummary(lines: DiffLine[]) {
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;
  const parts = [
    added && `added ${plural(added, "line", "lines")}`,
    removed && `removed ${plural(removed, "line", "lines")}`,
  ].filter(Boolean) as string[];
  const text = parts.join(", ") || "no changes";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The start of a tool's output, cut at `maxLines` lines or `maxChars` characters, and how many lines it hides. */
export function outputPreview(
  text: string,
  maxLines: number,
  maxChars: number,
) {
  const lines = text.replace(/\n+$/, "").split("\n");
  const head = lines.slice(0, maxLines).join("\n");
  if (head.length <= maxChars) {
    return {
      text: head,
      hidden: lines.length - Math.min(lines.length, maxLines),
    };
  }
  const cut = head.slice(0, maxChars);
  return { text: `${cut}…`, hidden: lines.length - cut.split("\n").length + 1 };
}
