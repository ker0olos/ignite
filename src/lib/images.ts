import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageContent } from "../../shared/agentTypes";
import { pngImage } from "@/lib/markup";
import { isRemote } from "@/lib/remote";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

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
      toImage(
        await readFile(path),
        TYPES[path.split(".").pop()!.toLowerCase()] ?? "image/png",
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
    input.onchange = () => void fileImages(input.files ?? []).then(resolve);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** The images among `files`, read; other files are left out. */
function fileImages(files: Iterable<File>) {
  const images = [...files].filter((f) =>
    Object.values(TYPES).includes(f.type),
  );
  return Promise.all(
    images.map(async (f) =>
      toImage(new Uint8Array(await f.arrayBuffer()), f.type),
    ),
  );
}

/** The images in a paste (screenshots, copied files). */
export const pastedImages = (data: DataTransfer) => fileImages(data.files);

/** A data URL to show an image block. */
export const imageUrl = (image: ImageContent) =>
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
