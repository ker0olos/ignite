/**
 * Each agent works in its own git worktree of the folder's repository, so
 * agents never edit each other's files or the user's. Its work reaches the
 * folder through git: a branch, a pull request, and the folder fast-forwarded
 * once it's merged. A folder of repositories gets a copy with a worktree of
 * each (worktreeGroup.ts); any other folder outside git is shared.
 */
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import {
  create,
  forkCheckout,
  isNew,
  lock,
  owner,
  remove,
  tidy,
} from "./worktreeCheckout.ts";
import { cloneIgnored } from "./worktreeClone.ts";
import { setReady, whenReady } from "./worktreeReady.ts";
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

const shared = (folder: string): Workspace => ({
  dir: folder,
  ready: Promise.resolve(),
});

async function repoFor(folder: string) {
  const repo = await gitOr(folder, ["rev-parse", "--show-toplevel"]);
  const head =
    repo && (await gitOr(repo, ["rev-parse", "-q", "--verify", "HEAD"]));
  if (!repo || !head) return null;
  const prefix = await git(folder, ["rev-parse", "--show-prefix"]);
  return { repo, prefix };
}

/** Saves and deletes the workspace at `path` (one worktree or a folder of them) once no live process holds it. */
async function release(
  path: string,
  id: string,
  sweeping = false,
  removing?: () => Promise<void>,
) {
  if (!existsSync(path)) return;
  const group = isGroup(path);
  const who = group ? await groupOwner(path) : owner(path);
  if (sweeping ? who !== "gone" || (await isNew(path)) : who === "alive")
    return;
  await removing?.();
  // Clones still going in would recreate folders after the delete.
  await whenReady(path);
  await (group ? removeGroup(path, id) : remove(path, id));
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
        return openGroup(folder, repos, worktreePath(folder, id, root), id);
      }
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
        await remove(path, id).catch(() => {});
        throw error;
      }
      // ponytail: a failed clone leaves the agent without some ignored files.
      const ready = cloneIgnored(found.repo, path).catch(() => {});
      setReady(path, ready);
      return { dir, ready };
    },

    /** Starts conversation `to`'s worktree(s) as a copy of `from`'s files (open or saved), detached at its commit. */
    async fork(folder: string, from: string, to: string) {
      const found = await repoFor(folder);
      if (found) {
        const path = worktreePath(found.repo, from, root);
        await forkCheckout(found.repo, path, from, to);
      } else
        await forkGroup(folder, worktreePath(folder, from, root), from, to);
    },

    /** Where `folder`'s conversations work, by id, without opening any; null when they share the folder. */
    async layout(folder: string): Promise<WorktreeLayout> {
      const found = await repoFor(folder);
      if (found) {
        const prefix = found.prefix.replace(/\/$/, "").split("/").join(sep);
        return { base: worktreeBase(found.repo, root), prefix };
      }
      const group = (await groupRepos(folder)).length > 0;
      return group ? { base: worktreeBase(folder, root), prefix: "" } : null;
    },

    /** Saves and deletes conversation `id`'s workspace, unless another window still uses it. */
    async close(folder: string, id: string, removing?: () => Promise<void>) {
      const found = await repoFor(folder);
      const path = worktreePath(found?.repo ?? folder, id, root);
      await release(path, id, false, removing);
    },

    /** Saves and deletes workspaces whose app process is gone (it crashed or was killed). */
    async sweep() {
      for (const repoKey of await readdir(root).catch(() => [])) {
        for (const id of await readdir(join(root, repoKey)).catch(() => [])) {
          if (id.startsWith(".")) continue;
          await release(join(root, repoKey, id), id, true).catch(() => {});
        }
        await tidy(join(root, repoKey));
      }
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
