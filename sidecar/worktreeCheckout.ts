/** One agent worktree of one repository: creating it (fresh or from saved state), whose it is, saving and removing it. */
import { randomUUID } from "node:crypto";
import { readdir, rm, rmdir, mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, uptime } from "node:os";
import { basename, dirname, join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import {
  git,
  gitOr,
  worktreeLock,
  repoFile,
  repoOf,
  restore,
  snapshot,
  stateRef,
  unbranched,
} from "./worktreeGit.ts";
import { checkpointRef, dropCheckpoints } from "./checkpoints.ts";

const LOCK = `${APP_NAME} pid `;

const verified = (repo: string, ref: string) =>
  gitOr(repo, ["rev-parse", "-q", "--verify", `${ref}^{commit}`]);

const fetching = new Map<string, Promise<unknown>>();

/** Fetches `repo`'s remote in the background, one fetch at a time; resolves when it's done. */
export function prefetch(repo: string) {
  const running = fetching.get(repo);
  if (running) return running;
  const done = gitOr(repo, ["fetch", "--quiet", "origin"]).finally(() =>
    fetching.delete(repo),
  );
  fetching.set(repo, done);
  return done;
}

// Pull requests branch off the remote's default branch, and the user's own
// uncommitted work stays out of them. A start never waits on the network: the
// remote is fetched when the folder shows and as each conversation starts.
/** The remote's default branch as last fetched; the folder's HEAD without a remote. */
export async function startPoint(repo: string): Promise<string> {
  void prefetch(repo);
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

/** Locks the worktree at `path` with this process's pid, so another window closing its conversation leaves it be. */
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
  // A worktree whose folder is gone stays registered while locked, or when a crash
  // came before its prune, and git won't add another at its path.
  await gitOr(repo, ["worktree", "unlock", path]);
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
 * deletes it, and its checkpoints unless `keepCheckpoints`. Throws, keeping it,
 * when the state can't be saved.
 */
export async function remove(
  path: string,
  id = basename(path),
  held?: () => Promise<boolean>,
  keepCheckpoints = false,
) {
  leave(path);
  const repo = repoOf(path);
  if (!repo) {
    await erase(path);
    await tidy(dirname(path));
    return true;
  }
  const branch = await gitOr(path, ["symbolic-ref", "-q", "--short", "HEAD"]);
  const message = `${APP_NAME} snapshot${branch ? `\n\nbranch: ${branch}` : ""}`;
  await git(repo, ["update-ref", stateRef(id), await snapshot(path, message)]);
  // The save takes a while, and a conversation may open the worktree meanwhile.
  if (await held?.()) return false;
  if (!keepCheckpoints) await dropCheckpoints(repo, id);
  await gitOr(repo, ["worktree", "unlock", path]);
  await erase(path, repo);
  await tidy(dirname(path));
  return true;
}

const ASIDE = ".removing-";

/** Deletes `path` (a worktree of `repo`, unregistered too), and what earlier deletes left aside. */
export async function erase(path: string, repo?: string) {
  const dir = dirname(dirname(path));
  // Moved out in one step first (beside its parent, so on the same disk): an open meanwhile,
  // or after a restart cut the delete short, finds it whole or gone, never half-deleted.
  const moved = await rename(path, join(dir, `${ASIDE}${randomUUID()}`)).then(
    () => true,
    () => false,
  );
  // Windows can't move or delete a file another process holds open.
  if (!moved)
    await (
      repo
        ? git(repo, ["worktree", "remove", "--force", path])
        : Promise.reject(new Error("no repository"))
    ).catch(() => rm(path, { recursive: true, force: true, maxRetries: 3 }));
  if (repo) await gitOr(repo, ["worktree", "prune"]);
  const names = await readdir(dir).catch(() => []);
  for (const name of names.filter((n) => n.startsWith(ASIDE)))
    await rm(join(dir, name), { recursive: true, force: true }).catch(() => {});
}

/** Gives conversation `to` a copy of `from`'s files in `repo`: as they were before message `entry` if checkpointed, else its worktree at `path` if open, else its saved state. */
export async function forkCheckout(
  repo: string,
  path: string,
  from: string,
  to: string,
  entry?: string,
) {
  const checkpoint =
    entry && (await verified(repo, checkpointRef(from, entry)));
  const saved =
    checkpoint || existsSync(path)
      ? null
      : await verified(repo, stateRef(from));
  const state =
    checkpoint ||
    (saved
      ? await unbranched(repo, saved)
      : existsSync(path) && (await snapshot(path)));
  if (state) await git(repo, ["update-ref", stateRef(to), state]);
}

/** Whose a worktree is, by its lock: this process's, another live one's, or nobody's. */
export function owner(path: string): "mine" | "alive" | "gone" {
  const lock = worktreeLock(path);
  const pid = Number(lock?.reason.match(new RegExp(`^${LOCK}(\\d+)`))?.[1]);
  if (!pid) return "gone";
  // Locked before this boot: its pid may now be another process's.
  if (lock!.since < Date.now() - uptime() * 1000) return "gone";
  if (pid === process.pid) return "mine";
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM" ? "alive" : "gone";
  }
}
