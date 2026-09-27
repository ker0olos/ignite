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

type ToolExecutionEvent = Extract<
  SessionEvent,
  {
    type:
      "tool_execution_start" | "tool_execution_update" | "tool_execution_end";
  }
>;

function applyToolExecutionEvent(
  t: Transcript,
  event: ToolExecutionEvent,
): Transcript {
  switch (event.type) {
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
  }
}

type RetryEvent = Extract<
  SessionEvent,
  { type: "auto_retry_start" | "auto_retry_end" }
>;

function applyRetryEvent(t: Transcript, event: RetryEvent): Transcript {
  if (event.type === "auto_retry_start") {
    return notice(
      t,
      `Retrying (${event.attempt}/${event.maxAttempts}): ${event.errorMessage}`,
    );
  }
  return event.success
    ? t
    : notice(t, event.finalError ?? "The request failed.", true);
}

type CompactionEvent = Extract<
  SessionEvent,
  { type: "compaction_start" | "compaction_end" }
>;

function applyCompactionEvent(
  t: Transcript,
  event: CompactionEvent,
): Transcript {
  if (event.type === "compaction_start") {
    return notice(t, "Compacting the conversation…");
  }
  return event.errorMessage ? notice(t, event.errorMessage, true) : t;
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
    default:
      return applyBackgroundEvent(t, event);
  }
}

function applyBackgroundEvent(t: Transcript, event: SessionEvent): Transcript {
  switch (event.type) {
    case "tool_execution_start":
    case "tool_execution_update":
    case "tool_execution_end":
      return applyToolExecutionEvent(t, event);
    case "auto_retry_start":
    case "auto_retry_end":
      return applyRetryEvent(t, event);
    case "compaction_start":
    case "compaction_end":
      return applyCompactionEvent(t, event);
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

type StreamUpdate = Extract<
  SessionEvent,
  { type: "message_update" }
>["assistantMessageEvent"];
type ContentBlock = AssistantMessage["content"][number];

function startOrEndBlock(update: StreamUpdate): ContentBlock | undefined {
  switch (update.type) {
    case "text_start":
      return { type: "text", text: "" };
    case "thinking_start":
      return { type: "thinking", thinking: "" };
    case "toolcall_start":
      return {
        type: "toolCall",
        id: update.id,
        name: update.toolName,
        arguments: {},
      };
    case "text_end":
      return { type: "text", text: update.content };
    case "thinking_end":
      return { type: "thinking", thinking: update.content };
    case "toolcall_end":
      return update.toolCall;
    default:
      return undefined;
  }
}

function deltaBlock(
  update: StreamUpdate,
  block: ContentBlock | undefined,
): ContentBlock | undefined {
  switch (update.type) {
    case "text_delta":
      return block?.type === "text"
        ? { ...block, text: block.text + update.delta }
        : undefined;
    case "thinking_delta":
      return block?.type === "thinking"
        ? { ...block, thinking: block.thinking + update.delta }
        : undefined;
    default:
      // toolcall_delta streams partial JSON; the call shows once it ends.
      return undefined;
  }
}

function updateStreaming(t: Transcript, update: StreamUpdate): Transcript {
  const i = t.items.findLastIndex(
    (item) => item.kind === "message" && item.message.role === "assistant",
  );
  if (i < 0 || !("contentIndex" in update)) return t;
  const message = (t.items[i] as { message: AssistantMessage }).message;
  const content = message.content.slice();
  const at = update.contentIndex;
  const next = startOrEndBlock(update) ?? deltaBlock(update, content[at]);
  if (!next) return t;
  content[at] = next;
  const items = t.items.slice();
  items[i] = { kind: "message", message: { ...message, content } };
  return { ...t, items };
}
