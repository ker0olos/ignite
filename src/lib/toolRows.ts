import type {
  AssistantMessage,
  ToolCall,
  UserMessage,
} from "../../shared/agentTypes";
import { SUBAGENT_TOOL } from "../../shared/subagents";
import { readPlan, TASK_TOOL } from "../../shared/tasks";
import { compactionOf, type CompactionItem } from "./compaction";
import { shownReview } from "./diffTabs";
import { shownError } from "./runError";
import { sameToolRuns } from "./sameTool";
import type { Item, ToolRun } from "./transcript";

/** One row of the conversation as drawn. */
export type Row =
  | Extract<Item, { kind: "notice" }>
  | CompactionItem
  | { kind: "user"; message: UserMessage }
  | { kind: "text"; text: string }
  | { kind: "tool"; call: ToolCall }
  /** Consecutive calls of one tool, under one tile. */
  | { kind: "calls"; calls: ToolCall[] }
  | { kind: "end"; message: AssistantMessage };

type Block = AssistantMessage["content"][number];

const hasPlan = (call: ToolCall, tools: Record<string, ToolRun>) =>
  call.name === TASK_TOOL && !!readPlan(tools[call.id]?.result);

// Plan updates in a row show only the latest plan; a failed one stays.
const isPlanAfterPlan = (
  call: ToolCall,
  last: Row | undefined,
  tools: Record<string, ToolRun>,
) => last?.kind === "tool" && hasPlan(last.call, tools) && hasPlan(call, tools);

/** Adds a call, replacing the plan update before it when both carry a plan. */
function pushCall(rows: Row[], call: ToolCall, tools: Record<string, ToolRun>) {
  if (isPlanAfterPlan(call, rows.at(-1), tools)) {
    rows[rows.length - 1] = { kind: "tool", call };
  } else {
    rows.push({ kind: "tool", call });
  }
}

/** Adds one assistant content block to `rows`. */
function pushBlock(
  rows: Row[],
  block: Block,
  tools: Record<string, ToolRun>,
  error: string | undefined,
) {
  if (block.type === "text") {
    // Claude Code also sends its limit wording as the reply; the end row says it.
    if (block.text && block.text.trim() !== error)
      rows.push({ kind: "text", text: block.text });
  } else if (block.type !== "thinking") {
    pushCall(rows, block, tools);
  }
}

const isEndOfRun = (assistant: AssistantMessage) =>
  assistant.stopReason === "error" || assistant.stopReason === "aborted";

/** Flattens the transcript into rows: a tool call each, or consecutive calls of one tool together. */
export function toRows(
  items: Item[],
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
    const error = shownError(assistant);
    for (const block of assistant.content) {
      pushBlock(rows, block, tools, error);
    }
    if (isEndOfRun(assistant)) {
      rows.push({ kind: "end", message: assistant });
    }
  }
  return sameToolRuns(rows);
}

/** "1 line", "2 lines". */
export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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

/** `waiting` ordered as in `before`, with calls that just began to wait at the end: a prompt being answered keeps its place. */
export function inArrivalOrder(before: string[], waiting: string[]): string[] {
  const now = new Set(waiting);
  const kept = before.filter((id) => now.has(id));
  return [...kept, ...waiting.filter((id) => !kept.includes(id))];
}

/** Whether the user can skip waiting on `call`: a running foreground bash command that sleeps. */
export function canSkipWait(call: ToolCall, run: ToolRun): boolean {
  return (
    call.name === "bash" &&
    !call.arguments.background &&
    /\bsleep\b/.test(String(call.arguments.command ?? "")) &&
    run.status === "running" &&
    !run.approval
  );
}

/** Whether a running call has nothing to show under it yet; the working line already says it runs. */
export function showsNothingYet(
  call: ToolCall,
  run: ToolRun,
  text: string,
  skippable: boolean,
): boolean {
  if (run.status !== "running" || text || run.approval || skippable) {
    return false;
  }
  if (call.name === "write" || call.name === SUBAGENT_TOOL) return false;
  return !shownReview(run);
}

// A call and the calls its script made, in order.
const withNested = (id: string, tools: Record<string, ToolRun>) => [
  id,
  ...(tools[id]?.nested ?? []).map((c) => c.id),
];

/** Every call waiting for the user, a script's calls included, in transcript order. */
export function waitingCalls(
  items: Item[],
  tools: Record<string, ToolRun>,
): string[] {
  return items.flatMap((item) =>
    item.kind === "message" && item.message.role === "assistant"
      ? (item.message as AssistantMessage).content.flatMap((b) =>
          b.type === "toolCall"
            ? withNested(b.id, tools).filter((id) => tools[id]?.approval)
            : [],
        )
      : [],
  );
}
