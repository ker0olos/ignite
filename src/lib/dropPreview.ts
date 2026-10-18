import { stat } from "@tauri-apps/plugin-fs";
import { imageType } from "@/lib/images";
import { basename } from "@/lib/paths";

/** What's being dragged over the window, by name: folders, images, and other files. */
export type Peeked = { folders: string[]; images: string[]; files: string[] };

/** What the window shows while it's dragged over: which of the four overlays, its title and what letting go does. */
export type DropPreview = {
  kind: "folder" | "image" | "file" | "mixed";
  title: string;
  detail: string;
};

/** Sorts dragged paths by a quick stat (no reading); paths it can't stat are left out. */
export async function peekDrop(
  paths: string[],
  isDir: (path: string) => Promise<boolean> = async (p) =>
    (await stat(p)).isDirectory,
): Promise<Peeked> {
  const peeked: Peeked = { folders: [], images: [], files: [] };
  for (const path of paths) {
    const dir = await isDir(path).catch(() => null);
    if (dir === null) continue;
    const into = dir ? "folders" : imageType(path) ? "images" : "files";
    peeked[into].push(basename(path));
  }
  return peeked;
}

// "a", "a and b", "a, b and 2 more".
function listed(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

// Images alone are images; any other file among them makes them all files.
function attaching({ images, files }: Peeked) {
  const all = [...images, ...files];
  const noun = files.length ? "file" : "image";
  const what = all.length === 1 ? all[0] : `${all.length} ${noun}s`;
  return {
    noun: all.length === 1 ? noun : `${noun}s`,
    line: `${what} will be attached to this conversation.`,
  };
}

/** What the input showing takes from a drop: images and files with the composer, images only with the task sheet, neither elsewhere. */
export type Takes = { images: boolean; files: boolean };

/** The overlay for what's dragged, leaving out what the input showing can't take; null when that's everything. */
export function dropPreview(
  dragged: Peeked,
  takes: Takes = { images: true, files: true },
): DropPreview | null {
  const peeked = {
    folders: dragged.folders,
    images: takes.images ? dragged.images : [],
    files: takes.files ? dragged.files : [],
  };
  const { folders } = peeked;
  const attached = peeked.images.length + peeked.files.length;
  if (!folders.length && !attached) return null;
  const folderTitle = folders.length > 1 ? "Open folders" : "Open folder";
  const folderLine = `${listed(folders)} will be added to your folders.`;
  if (!attached)
    return { kind: "folder", title: folderTitle, detail: folderLine };
  const { noun, line } = attaching(peeked);
  const kind = peeked.files.length ? "file" : "image";
  if (!folders.length) return { kind, title: `Attach ${noun}`, detail: line };
  return {
    kind: "mixed",
    title: `${folderTitle}, attach ${noun}`,
    detail: `${folderLine}\n${line}`,
  };
}
