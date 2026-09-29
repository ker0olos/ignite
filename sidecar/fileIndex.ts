import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { gitOr } from "./worktreeGit.ts";

const MAX_FILES = 50_000;
const SKIPPED = new Set(["node_modules", "target", "dist", "build"]);

const gitFiles = async (folder: string) =>
  (
    await gitOr(folder, [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ])
  )
    ?.split("\0")
    .filter(Boolean) ?? null;

// Outside git: every file but dot folders and the usual dependency and build
// folders, breadth first, up to MAX_FILES. A repository inside (a folder of
// projects) lists what its git does, so its ignored files stay out.
async function walk(folder: string): Promise<string[]> {
  const files: string[] = [];
  const dirs = [""];
  while (dirs.length && files.length < MAX_FILES) {
    const dir = dirs.shift()!;
    const found = await listDir(folder, dir);
    files.push(...found.files);
    dirs.push(...found.dirs);
  }
  return files.slice(0, MAX_FILES);
}

// One folder of the walk: its files, and its folders still to walk.
async function listDir(folder: string, dir: string) {
  const entries = await readdir(join(folder, dir), {
    withFileTypes: true,
  }).catch(() => []);
  const at = (name: string) => (dir ? `${dir}/${name}` : name);
  const repo =
    dir && entries.some((e) => e.name === ".git")
      ? await gitFiles(join(folder, dir))
      : null;
  if (repo) return { files: repo.map(at), dirs: [] };
  return {
    files: entries.filter((e) => e.isFile()).map((e) => at(e.name)),
    dirs: entries
      .filter(
        (e) =>
          e.isDirectory() && !e.name.startsWith(".") && !SKIPPED.has(e.name),
      )
      .map((e) => at(e.name)),
  };
}

/**
 * The folder's files relative to it, as git sees them in a repository
 * (tracked and untracked, not ignored), else from a walk.
 */
export async function listFiles(folder: string): Promise<string[]> {
  const listed = await gitFiles(folder);
  return (listed ?? (await walk(folder))).slice(0, MAX_FILES);
}
