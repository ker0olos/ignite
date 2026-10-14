import {
  ARTIFACT_TOOL,
  type AssistantMessage,
  type SessionEvent,
} from "../../shared/agentTypes";

/** One streaming update to the assistant message pi is writing. */
export type StreamUpdate = Extract<
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
      // Without a name the row can't be drawn; it shows at toolcall_end.
      if (!update.toolName) return undefined;
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
    case "toolcall_delta":
      return toolDelta(block, update.delta);
    default:
      return undefined;
  }
}

// Only an artifact draws its call as it's written; others show once they end.
function toolDelta(block: ContentBlock | undefined, delta: string) {
  return block?.type === "toolCall" && block.name === ARTIFACT_TOOL
    ? { ...block, partialJson: (block.partialJson ?? "") + delta }
    : undefined;
}

/** The content block an update leaves at its index: a new or ended one, or one a delta grew. */
export function nextBlock(
  update: StreamUpdate,
  block: ContentBlock | undefined,
): ContentBlock | undefined {
  return startOrEndBlock(update) ?? deltaBlock(update, block);
}
