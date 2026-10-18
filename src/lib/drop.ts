import { readFile, stat } from "@tauri-apps/plugin-fs";
import type { ImageContent } from "../../shared/agentTypes";
import type { SentFile } from "../../shared/attachedFiles";
import { imageType, named, toImage } from "@/lib/images";
import { basename } from "@/lib/paths";

/** What was dropped on the window: folders to open, images and files to attach. */
export type Dropped = {
  folders: string[];
  images: { image: ImageContent; name: string }[];
  files: SentFile[];
};

// Larger text goes by path: the agent reads what it needs of it. The total keeps a drop of many from filling the context.
const MAX_TEXT = 200_000;
const MAX_TOTAL = 500_000;

type Fs = {
  stat: (path: string) => Promise<{ isDirectory: boolean; size: number }>;
  read: (path: string) => Promise<Uint8Array>;
};
const PLUGIN_FS: Fs = { stat, read: readFile };

type One =
  | { folder: string }
  | { image: ImageContent; name: string }
  | { file: SentFile };

/** `bytes` as text when they read as UTF-8 with no NUL; else undefined (a binary file). */
function asText(bytes: Uint8Array): string | undefined {
  if (bytes.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

async function sortOne(path: string, fs: Fs): Promise<One> {
  const info = await fs.stat(path);
  if (info.isDirectory) return { folder: path };
  const type = imageType(path);
  if (type) {
    const name = basename(path);
    return { image: named(toImage(await fs.read(path), type), name), name };
  }
  const text = info.size <= MAX_TEXT ? asText(await fs.read(path)) : undefined;
  return { file: text === undefined ? { path } : { path, text } };
}

// Text in full until the drop's total would pass MAX_TOTAL; the rest by path.
function capped(files: SentFile[]): SentFile[] {
  let total = 0;
  return files.map((f) => {
    if (f.text === undefined) return f;
    total += f.text.length;
    return total <= MAX_TOTAL ? f : { path: f.path };
  });
}

/** Sorts dropped paths, read in parallel: folders open, images attach as images, other files attach with their text inline (small text files) or by path; unreadable ones are left out. */
export async function sortDrop(
  paths: string[],
  fs: Fs = PLUGIN_FS,
): Promise<Dropped> {
  const sorted = await Promise.all(
    paths.map((p) => sortOne(p, fs).catch(() => null)),
  );
  const dropped: Dropped = { folders: [], images: [], files: [] };
  for (const one of sorted) {
    if (!one) continue;
    if ("folder" in one) dropped.folders.push(one.folder);
    else if ("image" in one) dropped.images.push(one);
    else dropped.files.push(one.file);
  }
  return { ...dropped, files: capped(dropped.files) };
}
