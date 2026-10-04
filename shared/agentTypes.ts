/**
 * pi's messages and session events as they cross the wire, from pi's
 * docs/message-types.md and docs/json.md. Only the fields the app reads are
 * typed; the rest pass through untouched.
 */

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; data: string; mimeType: string };
type ThinkingContent = {
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

/** The tool the agent shows the user an image file with; the image is in `details.image`. */
export const IMAGE_TOOL = "show_image";

/** The tool the agent embeds an HTML page in the conversation with; the page is in its `html` argument. */
export const HTML_TOOL = "show_html";

/** The tool that ends a bash command left running in the background. */
export const BASH_STOP_TOOL = "bash_stop";

/** A result's images: its own, and show_image's (kept out of the model's context). */
export function resultImages(result: ToolResult | undefined): ImageContent[] {
  if (!result) return [];
  const own = result.content.filter(
    (b): b is ImageContent => b.type === "image",
  );
  const shown = (result.details as { image?: ImageContent } | undefined)?.image;
  return shown?.type === "image" ? [...own, shown] : own;
}

export type ToolResultMessage = ToolResult & {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  timestamp: number;
};

/** Any other role (system, custom, summaries); shown only if understood. */
type OtherMessage = { role: string; timestamp?: number };

export type AgentMessage =
  UserMessage | AssistantMessage | ToolResultMessage | OtherMessage;

/** A streaming update to one content block of the assistant message. */
type AssistantMessageEvent =
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
  /** Messages sent mid-run that pi hasn't delivered yet, in delivery order. */
  | { type: "queue_update"; steering: string[]; followUp: string[] }
  | { type: "compaction_start"; reason: CompactionReason }
  /** The app's own: the tokens `/compact`'s summary has written so far. */
  | { type: "compaction_progress"; tokens: number }
  | {
      type: "compaction_end";
      reason: CompactionReason;
      result?: { summary: string; tokensBefore: number };
      aborted: boolean;
      errorMessage?: string;
    };

/** "manual" is `/compact`; the others happen on their own during or after a run. */
type CompactionReason = "manual" | "threshold" | "overflow";

/** What pi keeps of a compacted conversation's older messages. */
export type CompactionSummaryMessage = {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
};
