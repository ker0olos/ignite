/** show_audio and show_video: the agent plays the user an audio or video file, one it generated or any other. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  AUDIO_TOOL,
  AUDIO_TYPES,
  VIDEO_TOOL,
  VIDEO_TYPES,
  type AudioContent,
  type VideoContent,
} from "../shared/agentTypes.ts";
import { mediaFile } from "./imageExtension.ts";

// Audio is kept in the conversation's file, like images; video as a copy in the media folder.
const MAX_AUDIO_MB = 10;

/** The audio at `path` (relative to `cwd`), or why it can't be played. */
export async function loadAudio(
  path: string,
  cwd: string,
): Promise<AudioContent | string> {
  const found = await mediaFile(path, cwd, AUDIO_TYPES, MAX_AUDIO_MB);
  if (typeof found === "string") return found;
  const data = (await readFile(found.file)).toString("base64");
  return { type: "audio", data, mimeType: found.mimeType };
}

const MEDIA_DIR = join(homedir(), ".ignite", "media");

async function hashOf(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").slice(0, 16);
}

/** The video at `path` (relative to `cwd`) as a copy in `mediaDir` named by its content, or why it can't be played. */
// ponytail: copies are never deleted; prune them with their conversations if the folder grows.
export async function findVideo(
  path: string,
  cwd: string,
  mediaDir = MEDIA_DIR,
): Promise<VideoContent | string> {
  const found = await mediaFile(path, cwd, VIDEO_TYPES);
  if (typeof found === "string") return found;
  const copy = join(
    mediaDir,
    `${await hashOf(found.file)}${extname(found.file).toLowerCase()}`,
  );
  const exists = await stat(copy).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await mkdir(mediaDir, { recursive: true });
    await copyFile(found.file, copy);
  }
  return { type: "video", path: copy, mimeType: found.mimeType };
}

const MADE_BY =
  "For one you generated with an AI model (through bash, with any service), pass `model`, and `prompt` " +
  "word for word as you sent it, and the user sees them with it. Pass `prompt` only when the service took one: " +
  "leave it out rather than put settings (voice, speed, length) in its place.";

const PROMPT = Type.Optional(
  Type.String({
    description:
      "The text prompt the service took, word for word; left out when it took none.",
  }),
);

const path = Type.String({ description: "The file's path." });
const model = Type.Optional(
  Type.String({
    description: "The model that made it, as the service names it.",
  }),
);

export default function showMedia(pi: ExtensionAPI) {
  pi.registerTool({
    name: AUDIO_TOOL,
    label: "Play audio",
    description:
      `Give the user an audio file to play in the conversation (${Object.keys(AUDIO_TYPES).join(" ")}, up to ${MAX_AUDIO_MB} MB): ` +
      `music, speech, a sound. You can't hear it yourself. ${MADE_BY} ` +
      "For speech also `voice`, and `script`, the text spoken; then `prompt` is the direction, if the service took one.",
    promptSnippet: `${AUDIO_TOOL}: give the user an audio file to play, or one you generated with its model and prompt`,
    parameters: Type.Object({
      path,
      model,
      prompt: PROMPT,
      voice: Type.Optional(
        Type.String({ description: "For speech: the voice's name." }),
      ),
      script: Type.Optional(
        Type.String({ description: "For speech: the text spoken." }),
      ),
    }),
    async execute(_id, args, _signal, _onUpdate, ctx) {
      const audio = await loadAudio(args.path, ctx.cwd);
      if (typeof audio === "string") throw new Error(audio);
      return {
        content: [{ type: "text", text: "Given to the user to play." }],
        details: { audio },
      };
    },
  });

  pi.registerTool({
    name: VIDEO_TOOL,
    label: "Play video",
    description:
      `Give the user a video file to play in the conversation (${Object.keys(VIDEO_TYPES).join(" ")}). ` +
      `You can't watch it yourself. ${MADE_BY}`,
    promptSnippet: `${VIDEO_TOOL}: give the user a video file to play, or one you generated with its model and prompt`,
    parameters: Type.Object({
      path,
      model,
      prompt: PROMPT,
      avoid: Type.Optional(
        Type.String({ description: "The negative prompt, if one was sent." }),
      ),
      size: Type.Optional(
        Type.String({ description: "Its size in pixels (1280×720)." }),
      ),
      from: Type.Optional(
        Type.String({
          description:
            "The image it started from, by the path you showed it with.",
        }),
      ),
    }),
    async execute(_id, args, _signal, _onUpdate, ctx) {
      const video = await findVideo(args.path, ctx.cwd);
      if (typeof video === "string") throw new Error(video);
      return {
        content: [{ type: "text", text: "Given to the user to play." }],
        details: { video },
      };
    },
  });
}
