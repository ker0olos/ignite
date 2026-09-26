import type {
  AgentMessage,
  AssistantMessage,
  SessionEvent,
  ToolResult,
} from "../../shared/agentTypes";

export type Item =
  | { kind: "message"; message: AgentMessage }
  | { kind: "notice"; text: string; error?: boolean };

/** A tool call's progress, matched to its call by id. */
export type ToolRun = {
  status: "running" | "done" | "error";
  /** Latest partial output while running, then the final result. */
  result?: ToolResult;
};

export type Transcript = {
  items: Item[];
  tools: Record<string, ToolRun>;
  running: boolean;
};

export const EMPTY: Transcript = { items: [], tools: {}, running: false };

/** A transcript for a continued session's saved messages. */
export function fromHistory(
  messages: AgentMessage[],
  running: boolean,
): Transcript {
  return messages.reduce((t, message) => addMessage(t, message), {
    ...EMPTY,
    running,
  });
}

/**
 * Applies one pi session event, following pi's streaming rules
 * (docs/json.md): deltas build a block, `*_end` and `message_end` replace
 * it with pi's final version, and `agent_settled` ends the run.
 */
export function applyEvent(t: Transcript, event: SessionEvent): Transcript {
  switch (event.type) {
    case "agent_start":
      return { ...t, running: true };
    case "agent_settled":
      return { ...t, running: false };
    case "message_start":
      return addMessage(t, event.message);
    case "message_end":
      return finishMessage(t, event.message);
    case "message_update":
      return updateStreaming(t, event.assistantMessageEvent);
    case "tool_execution_start":
      return setTool(t, event.toolCallId, { status: "running" });
    case "tool_execution_update":
      return setTool(t, event.toolCallId, {
        status: "running",
        result: event.partialResult,
      });
    case "tool_execution_end":
      return setTool(t, event.toolCallId, {
        status: event.isError ? "error" : "done",
        result: event.result,
      });
    case "auto_retry_start":
      return notice(
        t,
        `Retrying (${event.attempt}/${event.maxAttempts}): ${event.errorMessage}`,
      );
    case "auto_retry_end":
      return event.success
        ? t
        : notice(t, event.finalError ?? "The request failed.", true);
    case "compaction_start":
      return notice(t, "Compacting the conversation…");
    case "compaction_end":
      return event.errorMessage ? notice(t, event.errorMessage, true) : t;
    default:
      return t;
  }
}

/** Shows a run pi accepted but couldn't carry out, and ends it. */
export function applyError(t: Transcript, error: string): Transcript {
  // pi's errors end with CLI help (/login, doc paths) that doesn't apply here.
  return { ...notice(t, error.split("\n\n")[0], true), running: false };
}

function notice(t: Transcript, text: string, error?: boolean): Transcript {
  return { ...t, items: [...t.items, { kind: "notice", text, error }] };
}

function addMessage(t: Transcript, message: AgentMessage): Transcript {
  const withResult = recordResult(t, message);
  return {
    ...withResult,
    items: [...withResult.items, { kind: "message", message }],
  };
}

function finishMessage(t: Transcript, message: AgentMessage): Transcript {
  const i = t.items.findLastIndex(
    (item) => item.kind === "message" && item.message.role === message.role,
  );
  if (i < 0) return addMessage(t, message);
  const items = t.items.slice();
  items[i] = { kind: "message", message };
  return { ...recordResult(t, message), items };
}

// A saved or finished tool result settles its call's row.
function recordResult(t: Transcript, message: AgentMessage): Transcript {
  if (message.role !== "toolResult" || !("toolCallId" in message)) return t;
  return setTool(t, message.toolCallId, {
    status: message.isError ? "error" : "done",
    result: { content: message.content, details: message.details },
  });
}

function setTool(t: Transcript, id: string, run: ToolRun): Transcript {
  return { ...t, tools: { ...t.tools, [id]: { ...t.tools[id], ...run } } };
}

function updateStreaming(
  t: Transcript,
  update: Extract<
    SessionEvent,
    { type: "message_update" }
  >["assistantMessageEvent"],
): Transcript {
  const i = t.items.findLastIndex(
    (item) => item.kind === "message" && item.message.role === "assistant",
  );
  if (i < 0 || !("contentIndex" in update)) return t;
  const message = (t.items[i] as { message: AssistantMessage }).message;
  const content = message.content.slice();
  const at = update.contentIndex;
  const block = content[at];

  switch (update.type) {
    case "text_start":
      content[at] = { type: "text", text: "" };
      break;
    case "thinking_start":
      content[at] = { type: "thinking", thinking: "" };
      break;
    case "toolcall_start":
      content[at] = {
        type: "toolCall",
        id: update.id,
        name: update.toolName,
        arguments: {},
      };
      break;
    case "text_delta":
      if (block?.type !== "text") return t;
      content[at] = { ...block, text: block.text + update.delta };
      break;
    case "thinking_delta":
      if (block?.type !== "thinking") return t;
      content[at] = { ...block, thinking: block.thinking + update.delta };
      break;
    case "text_end":
      content[at] = { type: "text", text: update.content };
      break;
    case "thinking_end":
      content[at] = { type: "thinking", thinking: update.content };
      break;
    case "toolcall_end":
      content[at] = update.toolCall;
      break;
    default:
      // toolcall_delta streams partial JSON; the call shows once it ends.
      return t;
  }
  const items = t.items.slice();
  items[i] = { kind: "message", message: { ...message, content } };
  return { ...t, items };
}
