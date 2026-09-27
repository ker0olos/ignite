import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageContent } from "../../shared/agentTypes";

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

/** Asks for image files and reads them; empty if the picker is cancelled. */
export async function pickImages(): Promise<ImageContent[]> {
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

/** The images in a paste (screenshots, copied files). */
export async function pastedImages(data: DataTransfer) {
  const files = [...data.files].filter((f) =>
    Object.values(TYPES).includes(f.type),
  );
  return Promise.all(
    files.map(async (f) =>
      toImage(new Uint8Array(await f.arrayBuffer()), f.type),
    ),
  );
}

/** A data URL to show an image block. */
export const imageUrl = (image: ImageContent) =>
  `data:${image.mimeType};base64,${image.data}`;
