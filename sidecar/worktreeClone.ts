import { execFile } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { git } from "./worktreeGit.ts";

const exec = promisify(execFile);

// Copy-on-write clones: a clone of a 1 GB node_modules takes 22 MB until changed.
/** `cp` flags that clone copy-on-write, where the platform has them. */
const CLONE_FLAGS: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ["-c", "-R", "-p"],
  linux: ["-R", "-p", "--reflink=always"],
};
const BATCH = 200;

/** The repository's ignored files and folders (node_modules, builds, .env…), relative to it. */
async function ignoredEntries(repo: string): Promise<string[]> {
  const out = await git(repo, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--directory",
    "-z",
  ]);
  return out
    .split("\0")
    .filter(Boolean)
    .map((e) => e.replace(/\/$/, ""));
}

function byParent(entries: string[]) {
  const groups = new Map<string, string[]>();
  for (const e of entries) {
    const parent = dirname(e);
    groups.set(parent, [...(groups.get(parent) ?? []), e]);
  }
  return groups;
}

// Where the filesystem can't clone, only files are copied (.env, local
// settings). Folders (dependencies, builds) would cost their full size, and a
// link would let the agent write into the user's; it installs its own.
async function copyIfFile(from: string, to: string) {
  if ((await stat(from)).isFile()) await copyFile(from, to);
}

/**
 * Gives the worktree at `into` the ignored files of the repository at `repo`,
 * which a checkout doesn't bring: dependencies, builds, local settings.
 */
export async function cloneIgnored(
  repo: string,
  into: string,
  flags: string[] | null = CLONE_FLAGS[process.platform] ?? null,
) {
  for (const [parent, entries] of byParent(await ignoredEntries(repo))) {
    const dest = join(into, parent);
    await mkdir(dest, { recursive: true });
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const cloned =
        flags &&
        (await exec("cp", [...flags, ...batch.map((e) => join(repo, e)), dest])
          .then(() => true)
          .catch(() => false));
      if (cloned) continue;
      for (const e of batch) {
        await copyIfFile(join(repo, e), join(into, e)).catch(() => {});
      }
    }
  }
}
