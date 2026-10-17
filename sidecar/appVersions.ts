/**
 * Which built version the launcher runs, and updates built beside the running
 * one in the background, run on the next start (see appBuild.ts).
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  APPS,
  buildVersion,
  isBuilt,
  LAUNCH,
  removeVersion,
  versionDir,
} from "./appBuild.ts";
import { git } from "./worktreeGit.ts";

type StateName = "good" | "bad" | "next" | "restart";

/** A launcher state file's text, "" when it's not there. */
export async function readState(name: StateName): Promise<string> {
  return (await readFile(join(LAUNCH, name), "utf8").catch(() => "")).trim();
}

/** Writes a launcher state file. */
export async function writeState(name: StateName, value: string) {
  await mkdir(LAUNCH, { recursive: true });
  await writeFile(join(LAUNCH, name), value);
}

/** Removes a launcher state file. */
export const clearState = (name: StateName) =>
  rm(join(LAUNCH, name), { force: true });

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const LOCK = join(APPS, "build.lock");

async function building() {
  const holder = Number(await readFile(LOCK, "utf8").catch(() => ""));
  return !!holder && alive(holder);
}

/** Runs `build` unless a process (this one too) is building a version. */
async function withLock<T>(build: () => Promise<T>): Promise<T> {
  await mkdir(APPS, { recursive: true });
  if (await building()) throw new Error("An update is already being built.");
  await writeFile(LOCK, String(process.pid));
  try {
    return await build();
  } finally {
    await rm(LOCK, { force: true });
  }
}

/** The user's clone that a checkout (itself, or a version's worktree) belongs to. */
export async function cloneOf(checkout: string) {
  const common = await git(checkout, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  return dirname(common);
}

// Moves the clone too, so the next start runs the new launcher; only a clean
// checkout with no commits of its own, so a working clone is left alone.
async function moveClone(clone: string, sha: string) {
  // npm and cargo rewrite these themselves; they aren't the user's edits.
  await git(clone, [
    "checkout",
    "-q",
    "--",
    "package-lock.json",
    "src-tauri/Cargo.lock",
  ]);
  await git(clone, ["diff", "--quiet", "HEAD"]);
  await git(clone, ["merge-base", "--is-ancestor", "HEAD", sha]);
  await git(clone, ["reset", "-q", "--hard", sha]);
}

/**
 * Fetches main and builds it beside the running version `root` (a launcher
 * version's folder), with `mods`. The commit to restart into once one is
 * ready, else null: nothing new, or the latest already failed to start.
 */
export async function stageUpdate(
  root: string,
  mods: string,
): Promise<string | null> {
  const clone = await cloneOf(root);
  await git(clone, ["fetch", "-q", "origin", "main"]);
  const latest = await git(clone, ["rev-parse", "origin/main"]);
  if (latest === (await git(root, ["rev-parse", "HEAD"]))) return null;
  if (latest === (await readState("bad"))) return null;
  await withLock(() => buildVersion(clone, latest, root, mods));
  await moveClone(clone, latest).catch(() => {});
  await writeState("next", latest);
  return latest;
}

/** Removes versions other than `keep`, and unfinished ones no process is still building. */
export async function pruneVersions(clone: string, keep: string[]) {
  const names = await readdir(APPS).catch(() => []);
  const busy = await building();
  for (const name of names) {
    if (!/^[0-9a-f]{40}$/.test(name) || keep.includes(name)) continue;
    if (busy && !isBuilt(versionDir(name))) continue;
    await removeVersion(clone, versionDir(name));
  }
}
