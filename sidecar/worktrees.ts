/**
 * Each agent works in its own git worktree of the folder's repository, so
 * agents never edit each other's files or the user's. Its work reaches the
 * folder through git: a branch, a pull request, and the folder fast-forwarded
 * once it's merged. A folder outside git is shared.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { cloneIgnored } from "./worktreeClone.ts";
import {
  git,
  gitOr,
  lockReason,
  repoFile,
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

const lock = async (repo: string, path: string) => {
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

/** The branch conversation `id`'s worktree was on when last saved, if any. */
export async function savedBranch(folder: string, id: string) {
  const found = await repoFor(folder);
  const message =
    found &&
    (await gitOr(found.repo, ["log", "-1", "--format=%B", stateRef(id)]));
  return message?.match(BRANCH)?.[1];
}

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

// Resumes the conversation's saved state, else starts fresh from startPoint.
async function create(repo: string, path: string, id: string) {
  const saved = await verified(repo, stateRef(id));
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(repoFile(path), repo);
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

// A repository's folder goes once its last worktree has.
async function tidy(dir: string) {
  const left = await readdir(dir).catch(() => [".repo", "?"]);
  if (left.some((f) => f !== ".repo")) return;
  await rm(join(dir, ".repo"), { force: true });
  await rmdir(dir).catch(() => {});
}

// Deleting the directory the process is in would break later process.cwd() calls.
function leave(path: string) {
  try {
    if (!process.cwd().startsWith(path)) return;
  } catch {
    // Already gone.
  }
  process.chdir(homedir());
}

/**
 * Saves the worktree's state (and branch) under its conversation, then
 * deletes it. Throws, keeping it, when the state can't be saved.
 */
async function remove(path: string) {
  leave(path);
  const repo = repoOf(path);
  if (!repo) {
    await rm(path, { recursive: true, force: true });
    await tidy(dirname(path));
    return;
  }
  const id = path.split(/[\\/]/).pop()!;
  const branch = await gitOr(path, ["symbolic-ref", "-q", "--short", "HEAD"]);
  const message = `${APP_NAME} snapshot${branch ? `\n\nbranch: ${branch}` : ""}`;
  await git(repo, ["update-ref", stateRef(id), await snapshot(path, message)]);
  await gitOr(repo, ["worktree", "unlock", path]);
  // Windows can't delete a file another process holds open; then a later
  // sweep tries again, as the lock names a process that's gone by then.
  await git(repo, ["worktree", "remove", "--force", path]).catch(() =>
    rm(path, { recursive: true, force: true, maxRetries: 3 }),
  );
  await gitOr(repo, ["worktree", "prune"]);
  await tidy(dirname(path));
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
      if (existsSync(path)) {
        // Another window's, still in use, stays its; else (a crash) it's ours now.
        if (owner(path) !== "alive") await lock(found.repo, path);
        return { dir, ready: Promise.resolve() };
      }
      try {
        await create(found.repo, path, id);
      } catch (error) {
        await remove(path).catch(() => {});
        throw error;
      }
      // ponytail: a failed clone leaves the agent without some ignored files.
      return { dir, ready: cloneIgnored(found.repo, path).catch(() => {}) };
    },

    /** Saves and deletes conversation `id`'s worktree, unless another window still uses it. */
    async close(folder: string, id: string) {
      const found = await repoFor(folder);
      const path = found && worktreePath(found.repo, id, root);
      if (path && existsSync(path) && owner(path) !== "alive")
        await remove(path);
    },

    /** Saves and deletes worktrees whose app process is gone (it crashed or was killed). */
    async sweep() {
      for (const repoKey of await readdir(root).catch(() => [])) {
        for (const id of await readdir(join(root, repoKey)).catch(() => [])) {
          if (id.startsWith(".")) continue;
          const path = join(root, repoKey, id);
          if (owner(path) === "gone" && !(await isNew(path))) {
            await remove(path).catch(() => {});
          }
        }
        await tidy(join(root, repoKey));
      }
    },
  };
}

export type Workspaces = ReturnType<typeof createWorkspaces>;

/** Whose a worktree is, by its lock: this process's, another live one's, or nobody's. */
function owner(path: string): "mine" | "alive" | "gone" {
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

const isNew = async (path: string) =>
  Date.now() - (await stat(path)).mtimeMs < NEW_MS;

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
