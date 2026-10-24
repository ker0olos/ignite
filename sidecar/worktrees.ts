/**
 * Each agent works in its own git worktree of the folder's repository, so
 * agents never edit each other's files or the user's. Its work reaches the
 * folder through git: a branch, a pull request, and the folder fast-forwarded
 * once it's merged. A folder of repositories gets a copy with a worktree of
 * each (worktreeGroup.ts); any other folder outside git is shared.
 */
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import {
  create,
  forkCheckout,
  lock,
  owner,
  prefetch,
  remove,
} from "./worktreeCheckout.ts";
import { cloneMissing } from "./worktreeClone.ts";
import { dropDoppler } from "./doppler.ts";
import { dropReady, setReady } from "./worktreeReady.ts";
import type { WorktreeLayout } from "../shared/git.ts";
import {
  git,
  gitOr,
  WORKTREES,
  worktreeBase,
  worktreePath,
} from "./worktreeGit.ts";
import {
  forkGroup,
  groupOwner,
  groupRepos,
  isGroup,
  openGroup,
  removeGroup,
  type Workspace,
} from "./worktreeGroup.ts";

export type { Workspace };

const shared = (folder: string): Workspace => ({ dir: folder });

async function repoFor(folder: string) {
  const repo = await gitOr(folder, ["rev-parse", "--show-toplevel"]);
  const head =
    repo && (await gitOr(repo, ["rev-parse", "-q", "--verify", "HEAD"]));
  if (!repo || !head) return null;
  const prefix = await git(folder, ["rev-parse", "--show-prefix"]);
  return { repo, prefix };
}

// A conversation reopened while its workspace is being removed stops that at
// its next worktree, and waits for it, so it never takes one git is deleting.
const opening = new Map<string, number>();
const releasing = new Map<string, Promise<unknown>>();

async function openWhenReleased<T>(path: string, open: () => Promise<T>) {
  opening.set(path, (opening.get(path) ?? 0) + 1);
  try {
    await releasing.get(path);
    return await open();
  } finally {
    const left = opening.get(path)! - 1;
    if (left) opening.set(path, left);
    else opening.delete(path);
  }
}

/** Saves and deletes the workspace at `path` (one worktree or a folder of them) unless another live window holds it. */
async function release(
  path: string,
  id: string,
  removing?: (path: string) => Promise<void>,
) {
  if (!existsSync(path)) return dropDoppler(path);
  const group = isGroup(path);
  const held = async () =>
    opening.has(path) ||
    (group ? await groupOwner(path) : owner(path)) === "alive";
  if (await held()) return;
  await removing?.(path);
  const keep = await dropReady(path);
  const removed = await (
    group ? removeGroup(path, id, held) : remove(path, id, held)
  ).catch((error) => {
    // Kept (it couldn't be saved): it still needs its ignored files.
    keep();
    throw error;
  });
  if (!removed) return keep();
  dropDoppler(path);
}

async function openOne(
  found: { repo: string; prefix: string },
  path: string,
  id: string,
): Promise<Workspace> {
  const dir = resolve(path, found.prefix);
  if (existsSync(path)) {
    // Another window's, still in use, stays its; else (a quit or crash) it's
    // ours now, and gets what its clone hadn't brought yet.
    if (owner(path) === "gone") {
      await lock(found.repo, path);
      setReady(path, () => cloneMissing(found.repo, path).catch(() => {}));
    }
    return { dir };
  }
  try {
    await create(found.repo, path, id);
  } catch (error) {
    await remove(path, id).catch(() => {});
    throw error;
  }
  // ponytail: a failed clone leaves the agent without some ignored files.
  setReady(path, () => cloneMissing(found.repo, path).catch(() => {}));
  return { dir };
}

/** Agents' worktrees under `root`. */
export function createWorkspaces(root = WORKTREES) {
  return {
    /** Opens conversation `id`'s workspace for `folder`, creating its worktree(s) if needed. */
    async open(folder: string, id: string): Promise<Workspace> {
      const found = await repoFor(folder);
      if (!found) {
        const repos = await groupRepos(folder);
        if (!repos.length) return shared(folder);
        const path = worktreePath(folder, id, root);
        return openWhenReleased(path, () => openGroup(folder, repos, path, id));
      }
      const path = worktreePath(found.repo, id, root);
      return openWhenReleased(path, () => openOne(found, path, id));
    },

    /** Starts conversation `to`'s worktree(s) as a copy of `from`'s files (before message `entry`, open or saved), detached at its commit. */
    async fork(folder: string, from: string, to: string, entry?: string) {
      const found = await repoFor(folder);
      if (found) {
        const path = worktreePath(found.repo, from, root);
        await forkCheckout(found.repo, path, from, to, entry);
      } else
        await forkGroup(folder, worktreePath(folder, from, root), from, to);
    },

    /** Where `folder`'s conversations work, by id, without opening any; null when they share the folder. */
    async layout(folder: string): Promise<WorktreeLayout> {
      const found = await repoFor(folder);
      const repos = found ? [found.repo] : await groupRepos(folder);
      // The folder is showing: fetched now, for the conversation it may start.
      for (const repo of repos) void prefetch(repo);
      if (found) {
        const prefix = found.prefix.replace(/\/$/, "").split("/").join(sep);
        return { base: worktreeBase(found.repo, root), prefix };
      }
      return repos.length
        ? { base: worktreeBase(folder, root), prefix: "" }
        : null;
    },

    /** Saves and deletes conversation `id`'s workspace as it's closed, unless another window still uses it. Nothing else removes one: a reload or quit leaves it for the conversation to reopen. */
    async close(
      folder: string,
      id: string,
      removing?: (path: string) => Promise<void>,
    ) {
      const found = await repoFor(folder);
      const path = worktreePath(found?.repo ?? folder, id, root);
      const done = release(path, id, removing);
      const settled = done.catch(() => {});
      releasing.set(path, settled);
      void settled.then(() => {
        if (releasing.get(path) === settled) releasing.delete(path);
      });
      await done;
    },
  };
}

export type Workspaces = ReturnType<typeof createWorkspaces>;

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
