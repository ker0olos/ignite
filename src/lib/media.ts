import {
  IMAGE_TOOL,
  resultImages,
  type AssistantMessage,
  type ImageContent,
  type ToolCall,
} from "../../shared/agentTypes";
import type { Item, ToolRun } from "./transcript";

export type Generation = {
  model: string;
  prompt: string;
  avoid?: string;
  size?: string;
  editOf?: string;
};

const text = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

/** A show_image call's generation metadata (model, prompt, size), or null when it names no model and prompt. */
export function readGeneration(
  args: Record<string, unknown>,
): Generation | null {
  const model = text(args.model);
  const prompt = text(args.prompt);
  if (!model || !prompt) return null;
  return {
    model,
    prompt,
    avoid: text(args.avoid),
    size: text(args.size),
    editOf: text(args.editOf),
  };
}

/** What a call's media card shows; null draws the usual row (other tools, plain images, a failed call or one awaiting approval). */
export function cardGeneration(
  call: ToolCall,
  run: ToolRun | undefined,
): Generation | null {
  if (call.name !== IMAGE_TOOL || run?.status === "error" || run?.approval) {
    return null;
  }
  return readGeneration(call.arguments);
}

const imageCalls = (item: Item) =>
  item.kind === "message" && item.message.role === "assistant"
    ? (item.message as AssistantMessage).content.filter(
        (b): b is ToolCall => b.type === "toolCall" && b.name === IMAGE_TOOL,
      )
    : [];

/**
 * Each edit's original, by the edit's call id: what the conversation last
 * showed at its `editOf` path before it, so an edit saved over its original still compares.
 */
// ponytail: paths match as written; resolve them against the folder if agents mix relative and absolute.
export function editOriginals(
  items: Item[],
  tools: Record<string, ToolRun>,
): Map<string, ImageContent> {
  const shown = new Map<string, ImageContent>();
  const originals = new Map<string, ImageContent>();
  for (const call of items.flatMap(imageCalls)) {
    const original = shown.get(String(call.arguments.editOf));
    if (original) originals.set(call.id, original);
    const image = resultImages(tools[call.id]?.result)[0];
    if (image) shown.set(String(call.arguments.path), image);
  }
  return originals;
}
