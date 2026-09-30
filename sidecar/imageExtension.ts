/** show_image: the agent shows the user an image file from anywhere on disk, in its tool row and on its task's card. */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { IMAGE_TOOL, type ImageContent } from "../shared/agentTypes.ts";
import type { Task } from "../shared/tasks.ts";
import { askTask } from "./taskExtension.ts";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const MAX_BYTES = 20 * 1024 * 1024;

/** The image at `path` (relative to `cwd`), or why it can't be shown. */
export async function loadImage(
  path: string,
  cwd: string,
): Promise<ImageContent | string> {
  // As pi's own tools read paths: `@` dropped, `~` expanded.
  const bare = path.replace(/^@/, "").replace(/^~(?=[/\\]|$)/, homedir());
  const file = resolve(cwd, bare);
  const mimeType = TYPES[extname(file).toLowerCase()];
  if (!mimeType) {
    return `Not an image: ${file}. Supported: ${Object.keys(TYPES).join(" ")}`;
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
  return "Shown to the user in the chat, but too big to add to the task. Save a smaller image (e.g. a viewport screenshot) to put it there.";
}

export default function showImage(pi: ExtensionAPI) {
  pi.registerTool({
    name: IMAGE_TOOL,
    label: "Show image",
    description:
      "Show the user an image file (png, jpg, gif, webp, svg) in the conversation. " +
      "The path may be anywhere, e.g. a render or screenshot you saved in /tmp.",
    promptSnippet: `${IMAGE_TOOL}: show the user an image file`,
    parameters: Type.Object({
      path: Type.String({ description: "The image file's path." }),
    }),
    async execute(_id, { path }, _signal, _onUpdate, ctx) {
      const image = await loadImage(path, ctx.cwd);
      if (typeof image === "string") throw new Error(image);
      const task = await askTask(pi, "update", {
        image: { ...image, name: basename(path) },
      });
      return {
        content: [{ type: "text", text: shownText(task, image) }],
        details: { image },
      };
    },
  });
}
