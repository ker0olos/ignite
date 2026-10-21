/** show_image: the agent shows the user an image file from anywhere on disk, in its tool row and on its task's card. */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, resolve } from "node:path";
import {
  type ExtensionAPI,
  formatDimensionNote,
  resizeImage,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  IMAGE_TOOL,
  IMAGE_TYPES,
  type ImageContent,
} from "../shared/agentTypes.ts";
import type { Task } from "../shared/tasks.ts";
import { askTask } from "./taskExtension.ts";

const MAX_BYTES = 20 * 1024 * 1024;

/** The image at `path` (relative to `cwd`), or why it can't be shown. */
export async function loadImage(
  path: string,
  cwd: string,
): Promise<ImageContent | string> {
  // As pi's own tools read paths: `@` dropped, `~` expanded.
  const bare = path.replace(/^@/, "").replace(/^~(?=[/\\]|$)/, homedir());
  const file = resolve(cwd, bare);
  const mimeType = IMAGE_TYPES[extname(file).toLowerCase()];
  if (!mimeType) {
    return `Not an image: ${file}. Supported: ${Object.keys(IMAGE_TYPES).join(" ")}`;
  }
  const size = await stat(file).then(
    (s) => s.size,
    () => -1,
  );
  if (size < 0) return `No such file: ${file}`;
  if (size > MAX_BYTES) return `Too large (over 20 MB): ${file}`;
  const data = (await readFile(file)).toString("base64");
  return { type: "image", data, mimeType };
}

/** What the model reads back: shown, and whether it made it onto its task's card. */
export function shownText(task: Task | null, image: ImageContent): string {
  if (!task || task.shown?.at(-1)?.data === image.data) {
    return "Shown to the user.";
  }
  return "Shown to the user in the conversation, but too big to add to the task. Save a smaller image (e.g. a viewport screenshot) to put it there.";
}

/** The image for the model to see too, within the provider's size limits; none for SVG. */
export async function modelContent(
  image: ImageContent,
): Promise<(ImageContent | { type: "text"; text: string })[]> {
  if (image.mimeType === "image/svg+xml") return [];
  const bytes = Buffer.from(image.data, "base64");
  const resized = await resizeImage(bytes, image.mimeType).catch(() => null);
  if (!resized) return [];
  const note = formatDimensionNote(resized);
  return [
    { type: "image", data: resized.data, mimeType: resized.mimeType },
    ...(note ? [{ type: "text" as const, text: note }] : []),
  ];
}

export default function showImage(pi: ExtensionAPI) {
  pi.registerTool({
    name: IMAGE_TOOL,
    label: "Show image",
    description:
      "Show the user an image file (png, jpg, gif, webp, svg) in the conversation. " +
      "The path may be anywhere, e.g. a render or screenshot you saved in /tmp. " +
      "You see the image too (not SVG), so there's no need to read it again. " +
      "For an image you generated or edited with an AI model (through bash, with any service), " +
      "pass `model` and `prompt` and the user sees them with it; for an edit also `editOf`, " +
      "the path you showed the original with, and they get a before/after to compare.",
    promptSnippet: `${IMAGE_TOOL}: show the user an image file, or one you generated with its model and prompt`,
    parameters: Type.Object({
      path: Type.String({ description: "The image file's path." }),
      model: Type.Optional(
        Type.String({
          description:
            "The model that generated or edited it, as the service names it (fal-ai/flux-pro/v1.1).",
        }),
      ),
      prompt: Type.Optional(
        Type.String({
          description: "The prompt or edit instruction sent, word for word.",
        }),
      ),
      avoid: Type.Optional(
        Type.String({ description: "The negative prompt, if one was sent." }),
      ),
      size: Type.Optional(
        Type.String({ description: "Its size in pixels (1536×864)." }),
      ),
      editOf: Type.Optional(
        Type.String({
          description:
            "For an edit: the path the image it changed was shown with, exactly as you passed it then.",
        }),
      ),
    }),
    async execute(_id, { path }, _signal, _onUpdate, ctx) {
      const image = await loadImage(path, ctx.cwd);
      if (typeof image === "string") throw new Error(image);
      const task = await askTask(pi, "update", {
        image: { ...image, name: basename(path) },
      });
      return {
        content: [
          { type: "text", text: shownText(task, image) },
          ...(await modelContent(image)),
        ],
        details: { image },
      };
    },
  });
}
