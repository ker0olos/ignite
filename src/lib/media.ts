import {
  AUDIO_TOOL,
  IMAGE_TOOL,
  VIDEO_TOOL,
  resultImages,
  type AssistantMessage,
  type AudioContent,
  type ImageContent,
  type ToolCall,
  type ToolResult,
  type VideoContent,
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

// A failed call shows its error, and one awaiting approval its prompt, in the usual row.
const drawsCard = (call: ToolCall, tool: string, run: ToolRun | undefined) =>
  call.name === tool && run?.status !== "error" && !run?.approval;

/** What a call's media card shows; null draws the usual row (other tools, plain images, a failed call or one awaiting approval). */
export function cardGeneration(
  call: ToolCall,
  run: ToolRun | undefined,
): Generation | null {
  if (!drawsCard(call, IMAGE_TOOL, run)) return null;
  return readGeneration(call.arguments);
}

export type AudioGeneration = {
  model?: string;
  prompt?: string;
  voice?: string;
  script?: string;
};

/** What a show_audio call's card shows (what made it, when the agent says); null draws the usual row. */
export function audioCard(
  call: ToolCall,
  run: ToolRun | undefined,
): AudioGeneration | null {
  if (!drawsCard(call, AUDIO_TOOL, run)) return null;
  const { model, prompt, voice, script } = call.arguments;
  return {
    model: text(model),
    prompt: text(prompt),
    voice: text(voice),
    script: text(script),
  };
}

/** An audio card's title: speech, or audio, "Generated" when the agent named the model. */
export function audioTitle({ model, voice, script }: AudioGeneration) {
  if (script || voice) return "Generated speech";
  return model ? "Generated audio" : "Audio";
}

/** The audio a show_audio result carries in `details.audio`. */
export function resultAudio(
  result: ToolResult | undefined,
): AudioContent | undefined {
  const audio = (
    result?.details as { audio?: Partial<AudioContent> } | undefined
  )?.audio;
  if (
    audio?.type === "audio" &&
    typeof audio.data === "string" &&
    typeof audio.mimeType === "string"
  ) {
    return audio as AudioContent;
  }
  return undefined;
}

export type VideoGeneration = {
  model?: string;
  prompt?: string;
  avoid?: string;
  size?: string;
  from?: string;
};

/** What a show_video call's card shows (what made it, when the agent says); null draws the usual row. */
export function videoCard(
  call: ToolCall,
  run: ToolRun | undefined,
): VideoGeneration | null {
  if (!drawsCard(call, VIDEO_TOOL, run)) return null;
  const { model, prompt, avoid, size, from } = call.arguments;
  return {
    model: text(model),
    prompt: text(prompt),
    avoid: text(avoid),
    size: text(size),
    from: text(from),
  };
}

/** The video a show_video result carries in `details.video`: its file's path, or inline data. */
export function resultVideo(
  result: ToolResult | undefined,
): VideoContent | undefined {
  const video = (
    result?.details as { video?: Partial<VideoContent> } | undefined
  )?.video;
  const source =
    typeof video?.path === "string" || typeof video?.data === "string";
  if (video?.type === "video" && typeof video.mimeType === "string" && source) {
    return video as VideoContent;
  }
  return undefined;
}

/** `count` bars for a waveform, each the loudest sample of its slice, scaled so the loudest is 1. */
export function peaks(samples: Float32Array, count: number): number[] {
  const bars = Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * samples.length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) * samples.length) / count),
    );
    let max = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      max = Math.max(max, Math.abs(samples[j]));
    }
    return max;
  });
  const top = Math.max(...bars);
  return top > 0 ? bars.map((b) => b / top) : bars;
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
