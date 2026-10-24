import type { RewoundFiles } from "./rewind.ts";

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
  /** The arguments' JSON so far, while a streamed call is written (app only). */
  partialJson?: string;
};

/** What the conversation runs on after routing; `kept` when the router left the user's default (it had no answer, or nothing to change). */
export type RouterPick = {
  model?: { provider: string; id: string; name: string };
  effort: string;
  kept: boolean;
};

export type UserMessage = {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
  /** pi's entry id, set by the sidecar on messages the conversation may rewind to (app only). */
  entryId?: string;
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

/** Image files the conversation can show, by extension. */
export const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** The tool the agent shows the user an image file with; the image is in `details.image`. */
export const IMAGE_TOOL = "show_image";

/** The tool the agent shows the user an audio file with (generated music or speech); the audio is in `details.audio`. */
export const AUDIO_TOOL = "show_audio";

export type AudioContent = { type: "audio"; data: string; mimeType: string };

/** Audio files the conversation can play, by extension. */
export const AUDIO_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
};

/** The tool the agent shows the user a video file with (a generated clip); the video is in `details.video`. */
export const VIDEO_TOOL = "show_video";

/** A video by its file's absolute path (too big to keep in the conversation), or inline `data` (the demo's). */
export type VideoContent = {
  type: "video";
  mimeType: string;
  path?: string;
  data?: string;
};

/** Video files the conversation can play, by extension. */
export const VIDEO_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/** The tool the agent shows an artifact with: one or more HTML or markdown pages, in its `pages` argument. */
export const ARTIFACT_TOOL = "show_artifact";

// No network but Google Fonts' stylesheets and files: the page could otherwise send what the agent read past the sandbox's allowed hosts.
/** The policy an HTML artifact page runs under, in its frame and in its check. */
export const ARTIFACT_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data: blob:; font-src data: https://fonts.gstatic.com; media-src data: blob:">`;

/** The artifact tool's earlier name, one HTML page in `html`; saved conversations still hold its calls. */
export const LEGACY_HTML_TOOL = "show_html";

/** The tool that ends a bash command left running in the background. */
export const BASH_STOP_TOOL = "bash_stop";

/** The tool that has the conversation carry on once a background command exits. */
export const BASH_WAIT_TOOL = "bash_wait";

/** A result's images; show_image's original, not the resized copy the model got. */
export function resultImages(result: ToolResult | undefined): ImageContent[] {
  if (!result) return [];
  const shown = (result.details as { image?: ImageContent } | undefined)?.image;
  if (shown?.type === "image") return [shown];
  return result.content.filter((b): b is ImageContent => b.type === "image");
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
  /** The app's, not pi's: the router reads `message` before it's sent to pi. */
  | { type: "routing_start"; message: UserMessage }
  /** `sent`: the message went on to pi; false when Stop dropped it. */
  | { type: "routing_end"; sent: boolean; picked?: RouterPick }
  | { type: "agent_end"; willRetry: boolean }
  | { type: "turn_end" }
  | { type: "message_start" | "message_end"; message: AgentMessage }
  | { type: "message_update"; assistantMessageEvent: AssistantMessageEvent }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      /** Set for a call a script (codemode) made. */
      parentToolCallId?: string;
    }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      partialResult: ToolResult;
      parentToolCallId?: string;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      result: ToolResult;
      isError: boolean;
      durationMs?: number;
      parentToolCallId?: string;
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
  /** The app's own: pi saved the user message sent at `timestamp` as entry `entryId`. */
  | { type: "message_entry"; timestamp: number; entryId: string }
  /** The app's own: the conversation went back to before user message `entryId`. */
  | { type: "rewound"; entryId: string; files: RewoundFiles }
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
