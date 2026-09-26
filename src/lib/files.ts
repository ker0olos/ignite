import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { withoutGitIgnored } from "./gitignore";
import { highlight } from "./highlight";

/** Never shown in the file tree, whatever the Git setting. */
const ALWAYS_HIDDEN = new Set([".git", ".DS_Store"]);

/** Larger files are not rendered in the file viewer. */
export const MAX_VIEW_BYTES = 2_000_000;

// A NUL byte in the first chunk is the same heuristic Git uses to call a file binary.
const BINARY_SNIFF_BYTES = 8000;

// ponytail: no fs watching, the tree reloads only when a folder is re-expanded or reopened
/** Lists `dir` for the file tree: hidden entries removed, folders first, then by name. */
export async function listDir(dir: string, hideGitIgnored: boolean) {
  let entries = (await readDir(dir)).filter((e) => !ALWAYS_HIDDEN.has(e.name));
  if (hideGitIgnored) entries = await withoutGitIgnored(dir, entries);
  return entries.sort(
    (a, b) =>
      Number(b.isDirectory) - Number(a.isDirectory) ||
      a.name.localeCompare(b.name),
  );
}

/** What the file viewer shows: highlighted HTML, or a message explaining why not. */
export type FileContent = { html: string } | { message: string };

/** Reads a file for the viewer. Never throws; failures become a message. */
export async function readForView(path: string): Promise<FileContent> {
  try {
    const bytes = await readFile(path);
    if (bytes.length > MAX_VIEW_BYTES) {
      return { message: "File is too large to show." };
    }
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
      return { message: "Binary file not shown." };
    }
    return { html: await highlight(new TextDecoder().decode(bytes), path) };
  } catch {
    return { message: "Couldn't read this file." };
  }
}
