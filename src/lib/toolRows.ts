import type {
  AssistantMessage,
  ToolCall,
  UserMessage,
} from "../../shared/agentTypes";
import type { Item } from "./transcript";

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

/** Adds one assistant content block to `rows`, folding it into a quiet group if it qualifies. */
function pushBlock(rows: Row[], block: Block, showThinking: boolean) {
  if (block.type === "text") {
    if (block.text) rows.push({ kind: "text", text: block.text });
  } else if (block.type === "thinking") {
    if (showThinking && (block.thinking || !block.redacted)) {
      rows.push({ kind: "thinking", thinking: block.thinking });
    }
  } else if (QUIET.has(block.name)) {
    const last = rows.at(-1);
    if (last?.kind === "group") last.calls.push(block);
    else rows.push({ kind: "group", calls: [block] });
  } else {
    rows.push({ kind: "tool", call: block });
  }
}

const isEndOfRun = (assistant: AssistantMessage) =>
  assistant.stopReason === "error" || assistant.stopReason === "aborted";

// Folding one call saves no space and hides what it ran.
const unfoldSingle = (row: Row): Row =>
  row.kind === "group" && row.calls.length === 1
    ? { kind: "tool", call: row.calls[0] }
    : row;

/** Flattens the transcript into rows, folding two or more consecutive quiet tool calls. */
export function toRows(items: Item[], showThinking = false): Row[] {
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
      pushBlock(rows, block, showThinking);
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
