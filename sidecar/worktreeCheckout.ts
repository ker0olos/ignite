/** One agent worktree of one repository: creating it (fresh or from saved state), whose it is, saving and removing it. */
import { readdir, rm, rmdir, mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import {
  git,
  gitOr,
  lockReason,
  repoFile,
  repoOf,
  restore,
  snapshot,
  stateRef,
  unbranched,
} from "./worktreeGit.ts";
import { dropCheckpoints } from "./checkpoints.ts";

const LOCK = `${APP_NAME} pid `;
const FETCH_WAIT_MS = 3_000;
// A worktree younger than this may not be locked yet; sweeps leave it be.
const NEW_MS = 60_000;

const verified = (repo: string, ref: string) =>
  gitOr(repo, ["rev-parse", "-q", "--verify", `${ref}^{commit}`]);

// Pull requests branch off the remote's latest default branch, and the
// user's own uncommitted work stays out of them. The fetch carries on in the
// background when it's slow, so a first message never waits on the network.
/** The remote's default branch, fetched if quick; the folder's HEAD without a remote. */
export async function startPoint(repo: string): Promise<string> {
  await Promise.race([
    gitOr(repo, ["fetch", "--quiet", "origin"]),
    new Promise((done) => setTimeout(done, FETCH_WAIT_MS)),
  ]);
  return (await remoteDefault(repo)) ?? "HEAD";
}

/** The remote's default branch as fetched (`origin/main`): its HEAD, else main or master; null without one. */
export async function remoteDefault(repo: string): Promise<string | null> {
  const head = await gitOr(repo, [
    "symbolic-ref",
    "-q",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  for (const ref of [head, "origin/main", "origin/master"]) {
    if (ref && (await verified(repo, ref))) return ref;
  }
  return null;
}

/** Locks the worktree at `path` with this process's pid, so sweeps know it's in use. */
export const lock = async (repo: string, path: string) => {
  await gitOr(repo, ["worktree", "unlock", path]);
  await git(repo, [
    "worktree",
    "lock",
    "--reason",
    `${LOCK}${process.pid}`,
    path,
  ]);
};

const BRANCH = /^branch: (.+)$/m;

// The branch the agent had checked out comes back with it, if it hasn't
// moved since (and isn't checked out elsewhere); else the worktree is detached.
async function addAt(repo: string, path: string, saved: string) {
  const branch = (
    await gitOr(repo, ["log", "-1", "--format=%B", saved])
  )?.match(BRANCH)?.[1];
  const tip = branch && (await verified(repo, `refs/heads/${branch}`));
  const base = await git(repo, ["rev-parse", `${saved}^`]);
  if (branch && tip === base) {
    const added = await gitOr(repo, ["worktree", "add", path, branch]);
    if (added !== null) return;
  }
  await git(repo, ["worktree", "add", "--detach", path, base]);
}

/** Adds conversation `id`'s worktree of `repo` at `path`, from its saved state or fresh; `named` writes the `.repo` file beside it. */
export async function create(
  repo: string,
  path: string,
  id: string,
  named = true,
) {
  const saved = await verified(repo, stateRef(id));
  // A locked worktree whose folder was deleted stays registered (prune skips
  // locked ones), and git won't add another at its path.
  if ((await gitOr(repo, ["worktree", "unlock", path])) !== null)
    await gitOr(repo, ["worktree", "prune"]);
  await mkdir(dirname(path), { recursive: true });
  if (named) await writeFile(repoFile(path), repo);
  if (saved) await addAt(repo, path, saved);
  else
    await git(repo, [
      "worktree",
      "add",
      "--detach",
      path,
      await startPoint(repo),
    ]);
  await lock(repo, path);
  if (saved) await restore(path, saved);
}

/** A repository's folder of worktrees goes once its last worktree has. */
export async function tidy(dir: string) {
  const left = await readdir(dir).catch(() => [".repo", "?"]);
  if (left.some((f) => f !== ".repo")) return;
  await rm(join(dir, ".repo"), { force: true });
  await rmdir(dir).catch(() => {});
}

/** Moves the process out of `path`: deleting the directory it's in would break later process.cwd() calls. */
export function leave(path: string) {
  try {
    if (!process.cwd().startsWith(path)) return;
  } catch {
    // Already gone.
  }
  process.chdir(homedir());
}

/**
 * Saves the worktree's state (and branch) under conversation `id`, then
 * deletes it. Throws, keeping it, when the state can't be saved.
 */
export async function remove(path: string, id = basename(path)) {
  leave(path);
  const repo = repoOf(path);
  if (!repo) {
    await rm(path, { recursive: true, force: true });
    await tidy(dirname(path));
    return;
  }
  const branch = await gitOr(path, ["symbolic-ref", "-q", "--short", "HEAD"]);
  const message = `${APP_NAME} snapshot${branch ? `\n\nbranch: ${branch}` : ""}`;
  await git(repo, ["update-ref", stateRef(id), await snapshot(path, message)]);
  await dropCheckpoints(repo, id);
  await gitOr(repo, ["worktree", "unlock", path]);
  // Windows can't delete a file another process holds open; then a later
  // sweep tries again, as the lock names a process that's gone by then.
  await git(repo, ["worktree", "remove", "--force", path]).catch(() =>
    rm(path, { recursive: true, force: true, maxRetries: 3 }),
  );
  await gitOr(repo, ["worktree", "prune"]);
  await tidy(dirname(path));
}

/** Gives conversation `to` a copy of `from`'s files in `repo` (its worktree at `path` if open, else its saved state). */
export async function forkCheckout(
  repo: string,
  path: string,
  from: string,
  to: string,
) {
  const saved = existsSync(path) ? null : await verified(repo, stateRef(from));
  const state = saved
    ? await unbranched(repo, saved)
    : existsSync(path) && (await snapshot(path));
  if (state) await git(repo, ["update-ref", stateRef(to), state]);
}

/** Whose a worktree is, by its lock: this process's, another live one's, or nobody's. */
export function owner(path: string): "mine" | "alive" | "gone" {
  const pid = Number(
    lockReason(path)?.match(new RegExp(`^${LOCK}(\\d+)`))?.[1],
  );
  if (!pid) return "gone";
  if (pid === process.pid) return "mine";
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM" ? "alive" : "gone";
  }
}

/** Whether `path` was made too recently for a sweep to judge it. */
export const isNew = async (path: string) =>
  Date.now() - (await stat(path)).mtimeMs < NEW_MS;
