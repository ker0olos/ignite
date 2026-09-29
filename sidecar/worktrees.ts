/**
 * Each agent works in its own git worktree of the folder's repository, so
 * agents never edit each other's files or the user's. Its work reaches the
 * folder through git: a branch, a pull request, and the folder fast-forwarded
 * once it's merged. A folder outside git is shared.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { cloneIgnored } from "./worktreeClone.ts";
import {
  git,
  gitOr,
  lockReason,
  repoOf,
  restore,
  snapshot,
  stateRef,
  WORKTREES,
  worktreePath,
} from "./worktreeGit.ts";

/** Where an agent works; `ready` settles once its ignored files are in place. */
export type Workspace = { dir: string; ready: Promise<void> };

const LOCK = `${APP_NAME} pid `;

const shared = (folder: string): Workspace => ({
  dir: folder,
  ready: Promise.resolve(),
});

const verified = (repo: string, ref: string) =>
  gitOr(repo, ["rev-parse", "-q", "--verify", `${ref}^{commit}`]);

// Pull requests branch off the remote's latest default branch, and the
// user's own uncommitted work stays out of them.
/** The remote's default branch, freshly fetched; the folder's HEAD without a remote. */
export async function startPoint(repo: string): Promise<string> {
  await gitOr(repo, ["fetch", "--quiet", "origin"]);
  const head = await gitOr(repo, [
    "symbolic-ref",
    "-q",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  for (const ref of [head, "origin/main", "origin/master"]) {
    if (ref && (await verified(repo, ref))) return ref;
  }
  return "HEAD";
}

// Resumes the conversation's saved state, else starts fresh from startPoint.
async function create(repo: string, path: string, id: string) {
  const saved = await verified(repo, stateRef(id));
  await mkdir(join(path, ".."), { recursive: true });
  const start = saved ? `${saved}^` : await startPoint(repo);
  await git(repo, ["worktree", "add", "--detach", path, start]);
  await git(repo, [
    "worktree",
    "lock",
    "--reason",
    `${LOCK}${process.pid}`,
    path,
  ]);
  if (saved) await restore(path, saved);
}

/** Saves the worktree's state under its conversation, then deletes it. */
async function remove(path: string) {
  const repo = repoOf(path);
  if (!repo) return rm(path, { recursive: true, force: true });
  const id = path.split(/[\\/]/).pop()!;
  const state = await snapshot(path).catch(() => null);
  if (state) await git(repo, ["update-ref", stateRef(id), state]);
  await gitOr(repo, ["worktree", "unlock", path]);
  // Windows can't delete a file another process holds open; then a later
  // sweep tries again, as the lock names a process that's gone by then.
  await git(repo, ["worktree", "remove", "--force", path]).catch(() =>
    rm(path, { recursive: true, force: true, maxRetries: 3 }),
  );
  await gitOr(repo, ["worktree", "prune"]);
  await rmdir(dirname(path)).catch(() => {});
}

async function repoFor(folder: string) {
  const repo = await gitOr(folder, ["rev-parse", "--show-toplevel"]);
  const head =
    repo && (await gitOr(repo, ["rev-parse", "-q", "--verify", "HEAD"]));
  if (!repo || !head) return null;
  const prefix = await git(folder, ["rev-parse", "--show-prefix"]);
  return { repo, prefix };
}

/** Agents' worktrees under `root`. */
export function createWorkspaces(root = WORKTREES) {
  return {
    /** Opens conversation `id`'s workspace for `folder`, creating its worktree if needed. */
    async open(folder: string, id: string): Promise<Workspace> {
      const found = await repoFor(folder);
      if (!found) return shared(folder);
      const path = worktreePath(found.repo, id, root);
      const dir = resolve(path, found.prefix);
      if (existsSync(path)) return { dir, ready: Promise.resolve() };
      try {
        await create(found.repo, path, id);
      } catch (error) {
        await remove(path).catch(() => {});
        throw error;
      }
      // ponytail: a failed clone leaves the agent without some ignored files.
      return { dir, ready: cloneIgnored(found.repo, path).catch(() => {}) };
    },

    /** Saves and deletes conversation `id`'s worktree, if it has one. */
    async close(folder: string, id: string) {
      const found = await repoFor(folder);
      const path = found && worktreePath(found.repo, id, root);
      if (path && existsSync(path)) await remove(path);
    },

    /** Saves and deletes worktrees whose app process is gone (it crashed or was killed). */
    async sweep() {
      for (const repoKey of await readdir(root).catch(() => [])) {
        for (const id of await readdir(join(root, repoKey)).catch(() => [])) {
          const path = join(root, repoKey, id);
          if (!(await ownerAlive(path))) await remove(path).catch(() => {});
        }
        await rmdir(join(root, repoKey)).catch(() => {});
      }
    },
  };
}

export type Workspaces = ReturnType<typeof createWorkspaces>;

async function ownerAlive(path: string) {
  const pid = Number(
    lockReason(path)?.match(new RegExp(`^${LOCK}(\\d+)`))?.[1],
  );
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Fast-forwards the user's folder to its upstream, as after an agent's pull
 * request merged; nothing happens if that isn't a clean fast-forward (the
 * folder has diverged or local changes are in the way). Says what happened,
 * for the agent.
 */
export async function updateFolder(folder: string): Promise<string> {
  const branch = await gitOr(folder, ["branch", "--show-current"]);
  if (!branch)
    return "The user's folder isn't on a branch, so it was left as is.";
  try {
    await git(folder, ["pull", "--ff-only", "--no-rebase", "--quiet"]);
    return `The user's folder (on ${branch}) is now up to date with its remote.`;
  } catch (error) {
    const why = (error as { stderr?: string }).stderr?.trim().split("\n")[0];
    return `The user's folder (on ${branch}) was left as is: ${why || "it can't be fast-forwarded"}.`;
  }
}
