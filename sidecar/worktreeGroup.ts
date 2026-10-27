/**
 * A folder that isn't a repository but holds some (`~/Projects/app` with
 * `server/` and `web/`): each conversation gets its own copy of it, every
 * repository in it a worktree of the user's, its other files copied in.
 */
import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { dropCheckpoints } from "./checkpoints.ts";
import {
  create,
  forkCheckout,
  leave,
  lock,
  owner,
  erase,
  remove,
  tidy,
} from "./worktreeCheckout.ts";
import { cloneEntries, cloneMissing, missingIn } from "./worktreeClone.ts";
import { setReady } from "./worktreeReady.ts";
import {
  gitOr,
  groupCheckouts,
  inGroupCopy,
  remoteName,
  repoFile,
  repoOf,
  WORKTREES,
} from "./worktreeGit.ts";

/** Where an agent works (its ignored files come in later; see worktreeReady.ts). */
export type Workspace = { dir: string };

/** The repositories (with a commit) directly in `folder`, by their own paths. */
export async function groupRepos(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(
    () => [],
  );
  const found = await Promise.all(
    entries
      .filter(
        (e) => e.isDirectory() && existsSync(join(folder, e.name, ".git")),
      )
      .map(async (e) => {
        const dir = join(folder, e.name);
        const head = await gitOr(dir, ["rev-parse", "-q", "--verify", "HEAD"]);
        return head ? dir : null;
      }),
  );
  return found.filter((r): r is string => !!r);
}

/** Whether the workspace at `path` is a folder of worktrees rather than one. */
export const isGroup = (path: string) =>
  existsSync(path) && !existsSync(join(path, ".git"));

/** Whose a workspace folder is: alive while any of its worktrees' processes is. */
export async function groupOwner(path: string) {
  const owners = groupCheckouts(path).map(owner);
  if (owners.includes("alive")) return "alive";
  return owners.includes("mine") ? "mine" : "gone";
}

// The folder's entries that aren't repositories, with whether each is a file (stat follows links).
async function looseEntries(folder: string) {
  const names = (await readdir(folder).catch(() => [])).filter(
    (n) => !existsSync(join(folder, n, ".git")),
  );
  const isFile = await Promise.all(
    names.map((n) =>
      stat(join(folder, n)).then(
        (s) => s.isFile(),
        () => false,
      ),
    ),
  );
  return {
    files: names.filter((_, i) => isFile[i]),
    folders: names.filter((_, i) => !isFile[i]),
  };
}

// ponytail: other files are copied in afresh, so the agent's changes to them aren't kept.
// A repository with no commit yet stays out: copying its .git would have the agent commit to a copy.
// Files come in at once, as pi reads the folder's instructions (CLAUDE.md) when
// the session opens; the folders it returns are cloned after.
async function copyLooseFiles(folder: string, path: string) {
  const { files } = await looseEntries(folder);
  await Promise.all(
    files.map((n) =>
      copyFile(
        join(folder, n),
        join(path, n),
        constants.COPYFILE_FICLONE,
      ).catch(() => {}),
    ),
  );
}

/** Saves each worktree in the workspace under conversation `id`, then deletes it all. Throws, keeping it, when one can't be saved. */
export async function removeGroup(
  path: string,
  id: string,
  held?: () => Promise<boolean>,
) {
  leave(path);
  const checkouts = groupCheckouts(path);
  const repos = checkouts.map(repoOf);
  // Checkpoints go only with the whole copy: a reopen can stop it partway.
  for (const checkout of checkouts)
    if (!(await remove(checkout, id, held, true))) return false;
  for (const repo of repos) if (repo) await dropCheckpoints(repo, id);
  await erase(path);
  await tidy(dirname(path));
  return true;
}

// A worktree that failed partway: gone, and unregistered, so the next open makes it again.
async function discard(repo: string, checkout: string) {
  await erase(checkout, repo);
}

// A quit or crashed app's worktrees are ours now, and get what their clone hadn't brought yet.
async function takeOver(repos: string[], path: string) {
  const taken: string[] = [];
  for (const repo of repos) {
    const checkout = join(path, basename(repo));
    if (owner(checkout) !== "gone") continue;
    await lock(repo, checkout);
    taken.push(repo);
  }
  return taken;
}

/** Opens conversation `id`'s copy of `folder` at `path`, adding a worktree for each of its `repos` not there yet. */
export async function openGroup(
  folder: string,
  repos: string[],
  path: string,
  id: string,
): Promise<Workspace> {
  const fresh = !existsSync(path);
  await mkdir(path, { recursive: true });
  await writeFile(repoFile(path), folder);
  const missing = repos.filter((r) => !existsSync(join(path, basename(r))));
  const made = await Promise.allSettled(
    missing.map((repo) => create(repo, join(path, basename(repo)), id, false)),
  );
  const failed = made.findIndex((m) => m.status === "rejected");
  if (failed >= 0) {
    for (const [i, m] of made.entries()) {
      if (m.status === "rejected")
        await discard(missing[i], join(path, basename(missing[i])));
    }
    if (fresh) await removeGroup(path, id).catch(() => {});
    throw (made[failed] as PromiseRejectedResult).reason;
  }
  const taken = await takeOver(
    repos.filter((r) => !missing.includes(r)),
    path,
  );
  if (fresh) await copyLooseFiles(folder, path);
  const cloning = [...missing, ...taken];
  if (!fresh && !cloning.length) return { dir: path };
  const { folders } = await looseEntries(folder);
  // One at a time: in parallel they starve Claude Code's start of the disk.
  setReady(path, async () => {
    for (const repo of cloning)
      await cloneMissing(repo, join(path, basename(repo))).catch(() => {});
    await cloneEntries(folder, missingIn(path, folders), path).catch(() => {});
  });
  return { dir: path };
}

/** Where a gh call (in `cwd`) works: in a copy of a folder of repositories, the worktree its -R names; else `cwd`. */
export async function ghDir(args: string[], cwd: string, root = WORKTREES) {
  const name = repoFlag(args);
  return (
    (name && inGroupCopy(cwd, root) && (await checkoutNamed(cwd, name))) || cwd
  );
}

// gh's -R in any form: `-R x`, `--repo x`, `--repo=x`, `-Rx`.
function repoFlag(args: string[]): string | undefined {
  for (const [i, a] of args.entries()) {
    if (a === "-R" || a === "--repo") return args[i + 1];
    if (a.startsWith("--repo=")) return a.slice("--repo=".length);
    if (a.startsWith("-R") && a.length > 2) return a.slice(2);
  }
  return undefined;
}

// The worktree in an agent's copy whose repository's origin is `name` (`owner/repo`, as gh's -R names it).
async function checkoutNamed(
  workspace: string,
  name: string,
): Promise<string | null> {
  for (const checkout of groupCheckouts(workspace)) {
    const url = await gitOr(checkout, ["remote", "get-url", "origin"]);
    if (url && remoteName(url)?.toLowerCase() === name.toLowerCase())
      return checkout;
  }
  return null;
}

/** Gives conversation `to` a copy of each of `folder`'s repositories as `from` has it in its workspace at `path`. */
export async function forkGroup(
  folder: string,
  path: string,
  from: string,
  to: string,
) {
  for (const repo of await groupRepos(folder)) {
    await forkCheckout(repo, join(path, basename(repo)), from, to);
  }
}
