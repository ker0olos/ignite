/**
 * pi's messages and session events as they cross the wire, from pi's
 * docs/message-types.md and docs/json.md. Only the fields the app reads are
 * typed; the rest pass through untouched.
 */

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; data: string; mimeType: string };
export type ThinkingContent = {
  type: "thinking";
  thinking: string;
  redacted?: boolean;
};
export type ToolCall = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type UserMessage = {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
};

export type AssistantMessage = {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  provider: string;
  model: string;
  stopReason:
    | "pending"
    | "stop"
    | "length"
    | "toolUse"
    | "error"
    | "aborted"
    | "deferred";
  errorMessage?: string;
  timestamp: number;
};

export type ToolResult = {
  content: (TextContent | ImageContent)[];
  details?: unknown;
};

export type ToolResultMessage = ToolResult & {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  timestamp: number;
};

/** Any other role (system, custom, summaries); shown only if understood. */
export type OtherMessage = { role: string; timestamp?: number };

export type AgentMessage =
  UserMessage | AssistantMessage | ToolResultMessage | OtherMessage;

/** A streaming update to one content block of the assistant message. */
export type AssistantMessageEvent =
  | { type: "text_start" | "thinking_start"; contentIndex: number }
  | {
      type: "text_delta" | "thinking_delta" | "toolcall_delta";
      contentIndex: number;
      delta: string;
    }
  | {
      type: "text_end";
      contentIndex: number;
      content: string;
    }
  | {
      type: "thinking_end";
      contentIndex: number;
      content: string;
    }
  | {
      type: "toolcall_start";
      contentIndex: number;
      id: string;
      toolName: string;
    }
  | { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall }
  | { type: "start" | "done" | "error" };

/**
 * pi's session events, with message_update in its delta-only wire form.
 * pi sends more types than these; the app ignores the ones it doesn't know.
 */
export type SessionEvent =
  | { type: "agent_start" | "agent_settled" | "turn_start" }
  | { type: "agent_end"; willRetry: boolean }
  | { type: "turn_end" }
  | { type: "message_start" | "message_end"; message: AgentMessage }
  | { type: "message_update"; assistantMessageEvent: AssistantMessageEvent }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      partialResult: ToolResult;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      result: ToolResult;
      isError: boolean;
    }
  | {
      type: "auto_retry_start";
      attempt: number;
      maxAttempts: number;
      errorMessage: string;
    }
  | {
      type: "auto_retry_end";
      success: boolean;
      finalError?: string;
    }
  | { type: "compaction_start"; reason: string }
  | {
      type: "compaction_end";
      aborted: boolean;
      errorMessage?: string;
    };
