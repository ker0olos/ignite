import type {
  AgentMessage,
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "./agentTypes.ts";
import type { RecentMessage, SessionDetails } from "./conversations.ts";
import { typedMessage } from "./sentComments.ts";
import { TASK_TOOL, type PlanDetails, type Subtask } from "./tasks.ts";

const RECENT = 4;
const TEXT_LENGTH = 400;
const EDITING = new Set(["edit", "write"]);

type Block = { type: string; text?: string };

type Draft =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; tools: number; edits: Set<string> };

const textOf = (content: string | Block[]) =>
  (typeof content === "string"
    ? content
    : content.map((c) => (c.type === "text" ? (c.text ?? "") : "")).join("")
  ).trim();

const callsOf = (content: Block[]) =>
  content.filter((c): c is ToolCall & Block => c.type === "toolCall");

/** One run of assistant messages, folded into the reply the user read. */
function addReply(recent: Draft[], content: Block[]) {
  let last = recent.at(-1);
  if (last?.role !== "assistant") {
    last = { role: "assistant", text: "", tools: 0, edits: new Set() };
    recent.push(last);
  }
  const calls = callsOf(content);
  last.tools += calls.length;
  for (const c of calls) {
    const path = c.arguments.path;
    if (EDITING.has(c.name) && typeof path === "string") last.edits.add(path);
  }
  const text = textOf(content);
  if (text) last.text = text.slice(0, TEXT_LENGTH);
}

// An image-only message still ends the reply before it.
function addUser(recent: Draft[], { content }: UserMessage) {
  const text =
    typedMessage(textOf(content)) ||
    (typeof content !== "string" && content.length ? "Image" : "");
  if (text) recent.push({ role: "user", text: text.slice(0, TEXT_LENGTH) });
}

// A plan saved before task_update reported its subtasks leaves the one before.
const planOf = (m: AgentMessage) => {
  if (m.role !== "toolResult") return undefined;
  const { toolName, details } = m as ToolResultMessage;
  const subtasks = (details as Partial<PlanDetails> | undefined)?.subtasks;
  return toolName === TASK_TOOL && Array.isArray(subtasks)
    ? subtasks
    : undefined;
};

const shown = (d: Draft): RecentMessage =>
  d.role === "user" ? d : { ...d, edits: d.edits.size };

/** A conversation's last four messages (each run of replies as one) and its latest subtasks. */
export function describeSession(messages: AgentMessage[]): SessionDetails {
  const recent: Draft[] = [];
  let subtasks: Subtask[] = [];
  for (const m of messages) {
    if (m.role === "user") addUser(recent, m as UserMessage);
    else if (m.role === "assistant")
      addReply(recent, (m as AssistantMessage).content);
    else subtasks = planOf(m) ?? subtasks;
  }
  return {
    recent: recent
      .filter((r) => r.role === "user" || r.text || r.tools)
      .slice(-RECENT)
      .map(shown),
    subtasks,
  };
}
