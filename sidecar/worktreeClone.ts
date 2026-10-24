import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
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

// cp -c clones file by file: 73k files in a node_modules take about 10s even
// copy-on-write. clonefile(2) clones a whole folder in one call (about 1s), and
// osascript, always on a Mac, is how Node reaches it.
const CLONEFILE = `const CLONE_NOFOLLOW = 1;
ObjC.bindFunction("clonefile", ["int", ["char *", "char *", "unsigned int"]]);
function run(argv) {
  const failed = [];
  for (let i = 0; i < argv.length; i += 2)
    if ($.clonefile(argv[i], argv[i + 1], CLONE_NOFOLLOW) !== 0) failed.push(argv[i]);
  return JSON.stringify(failed);
}`;

/** Clones each of `entries` whole with clonefile(2), a folder in one call; returns those it couldn't. */
async function cloneWhole(from: string, entries: string[], into: string) {
  const failed = new Set<string>();
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const args = batch.flatMap((e) => [join(from, e), join(into, e)]);
    const out = await exec("osascript", [
      "-l",
      "JavaScript",
      "-e",
      CLONEFILE,
      ...args,
    ])
      .then((r) => JSON.parse(r.stdout) as string[])
      .catch(() => null);
    for (const path of out ?? batch.map((e) => join(from, e))) failed.add(path);
  }
  return entries.filter((e) => failed.has(join(from, e)));
}

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
  whole = process.platform === "darwin",
) {
  await cloneEntries(repo, await ignoredEntries(repo), into, flags, whole);
}

/** The entries of `entries` that `into` lacks. */
export const missingIn = (into: string, entries: string[]) =>
  entries.filter((e) => !existsSync(join(into, e)));

/** Like cloneIgnored, for only the entries `into` lacks: all of them when it's new, what a clone a quit cut off hadn't brought when it's reopened. */
export async function cloneMissing(repo: string, into: string) {
  await cloneEntries(repo, missingIn(into, await ignoredEntries(repo)), into);
}

// cp -c clones each batch; where it can't, only files are copied.
async function cloneByFile(
  from: string,
  entries: string[],
  into: string,
  flags: string[] | null,
) {
  for (const [parent, group] of byParent(entries)) {
    const dest = join(into, parent);
    for (let i = 0; i < group.length; i += BATCH) {
      const batch = group.slice(i, i + BATCH);
      const cloned =
        flags &&
        (await exec("cp", [...flags, ...batch.map((e) => join(from, e)), dest])
          .then(() => true)
          .catch(() => false));
      if (cloned) continue;
      for (const e of batch) {
        await copyIfFile(join(from, e), join(into, e)).catch(() => {});
      }
    }
  }
}

/** Clones `entries` (paths relative to `from`) to the same places under `into`, `whole` ones in one call each (macOS); only files where the platform can't clone. */
export async function cloneEntries(
  from: string,
  entries: string[],
  into: string,
  flags: string[] | null = CLONE_FLAGS[process.platform] ?? null,
  whole = process.platform === "darwin",
) {
  for (const parent of byParent(entries).keys())
    await mkdir(join(into, parent), { recursive: true });
  const rest = flags && whole ? await cloneWhole(from, entries, into) : entries;
  await cloneByFile(from, rest, into, flags);
}
