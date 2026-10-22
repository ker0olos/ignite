import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageContent } from "../../shared/agentTypes";
import { pngImage } from "@/lib/markup";
import { basename } from "@/lib/paths";
import { isRemote } from "@/lib/remote";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

// The file an image came from, beside the image itself: a message carries only its bytes.
const names = new WeakMap<ImageContent, string>();

/** `image`, remembered as the file `name` it came from. */
export function named(image: ImageContent, name: string): ImageContent {
  names.set(image, name);
  return image;
}

/** The file name an image came from (with its extension), or undefined for one from the clipboard or drawn. */
export const imageName = (image: ImageContent) => names.get(image);

/** The image type a path's extension names, or null when it isn't one the agent takes. */
export const imageType = (path: string): string | null =>
  TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;

/** An image block for the agent, from raw bytes. */
export function toImage(bytes: Uint8Array, mimeType: string): ImageContent {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { type: "image", data: btoa(binary), mimeType };
}

/**
 * Asks for image files and reads them; empty if the picker is cancelled. In
 * a browser using remote access, the browser's own picker (a phone's photos).
 */
export async function pickImages(
  inBrowser = isRemote(),
): Promise<ImageContent[]> {
  if (inBrowser) return browserPick();
  const paths = await open({
    multiple: true,
    filters: [{ name: "Images", extensions: Object.keys(TYPES) }],
  });
  if (!paths) return [];
  return Promise.all(
    paths.map(async (path) =>
      named(
        toImage(await readFile(path), imageType(path) ?? "image/png"),
        basename(path),
      ),
    ),
  );
}

function browserPick() {
  return new Promise<ImageContent[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = Object.values(TYPES).join(",");
    input.multiple = true;
    input.onchange = () =>
      void fileImages(input.files ?? [], true).then(resolve);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** The images among `files`, read (`keepNames`: each named by its file); other files are left out. */
function fileImages(files: Iterable<File>, keepNames = false) {
  const images = [...files].filter((f) =>
    Object.values(TYPES).includes(f.type),
  );
  return Promise.all(
    images.map(async (f) => {
      const image = toImage(new Uint8Array(await f.arrayBuffer()), f.type);
      return keepNames ? named(image, f.name) : image;
    }),
  );
}

/** The images in a paste (screenshots, copied files), all unnamed: they come from the clipboard. */
export const pastedImages = (data: DataTransfer) => fileImages(data.files);

/** A data URL for an image, audio or video block. */
export const imageUrl = (image: { data: string; mimeType: string }) =>
  `data:${image.mimeType};base64,${image.data}`;

/** A white PNG page of the given size. */
export function blankImage(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
  }
  return pngImage(canvas.toDataURL("image/png"));
}
