import type {
  AssistantMessage,
  ToolCall,
  UserMessage,
} from "../../shared/agentTypes";
import { readShellEdits } from "../../shared/shellEdits";
import { readPlan, TASK_TOOL } from "../../shared/tasks";
import { compactionOf, type CompactionItem } from "./compaction";
import type { Item, ToolRun } from "./transcript";

/** One row of the conversation as drawn, with quiet tool calls folded together. */
export type Row =
  | Extract<Item, { kind: "notice" }>
  | CompactionItem
  | { kind: "user"; message: UserMessage }
  | { kind: "text"; text: string }
  | { kind: "thinking"; thinking: string }
  | { kind: "tool"; call: ToolCall }
  | { kind: "group"; calls: ToolCall[] }
  | { kind: "end"; message: AssistantMessage };

// Look-around tools that fold into one summary line, as in Claude Code.
const QUIET = new Set(["read", "grep", "find", "ls", "bash"]);

type Block = AssistantMessage["content"][number];

const hasPlan = (call: ToolCall, tools: Record<string, ToolRun>) =>
  call.name === TASK_TOOL && !!readPlan(tools[call.id]?.result);

// Plan updates in a row show only the latest plan; a failed one stays.
const isPlanAfterPlan = (
  call: ToolCall,
  last: Row | undefined,
  tools: Record<string, ToolRun>,
) => last?.kind === "tool" && hasPlan(last.call, tools) && hasPlan(call, tools);

/**
 * Folds a quiet call into the group before it. A failed call stands alone, so
 * a red row always means that call, and so does a command that changed files.
 */
function pushCall(rows: Row[], call: ToolCall, tools: Record<string, ToolRun>) {
  const run = tools[call.id];
  const last = rows.at(-1);
  if (isPlanAfterPlan(call, last, tools)) {
    rows[rows.length - 1] = { kind: "tool", call };
    return;
  }
  if (
    !QUIET.has(call.name) ||
    run?.status === "error" ||
    readShellEdits(run?.result?.details).length
  ) {
    rows.push({ kind: "tool", call });
    return;
  }
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
    if (item.kind !== "message") {
      rows.push(item);
      continue;
    }
    const { message } = item;
    const compaction = compactionOf(message);
    if (compaction) rows.push(compaction);
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

// Output shown open by default: one line that fits without wrapping much.
const SHORT_CHARS = 120;

/** Whether tool output is short enough to show instead of collapsing. */
export function isShortOutput(text: string): boolean {
  const trimmed = text.replace(/\n+$/, "");
  return !trimmed.includes("\n") && trimmed.length <= SHORT_CHARS;
}

/** The first tool call in the conversation that waits for the user, which the keyboard answers. */
export function firstWaiting(
  items: Item[],
  tools: Record<string, ToolRun>,
): string | null {
  for (const item of items) {
    if (item.kind !== "message" || item.message.role !== "assistant") continue;
    const { content } = item.message as AssistantMessage;
    const call = content.find(
      (b) => b.type === "toolCall" && tools[b.id]?.approval,
    );
    if (call?.type === "toolCall") return call.id;
  }
  return null;
}
