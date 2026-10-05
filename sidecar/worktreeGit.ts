import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { promisify } from "node:util";
import { APP_NAME } from "../src/lib/app.ts";

const exec = promisify(execFile);

/** Where agents' worktrees live: one folder per repository, one per agent. */
export const WORKTREES = join(homedir(), `.${APP_NAME}`, "worktrees");

// The app's own commits carry its name, so they work without user.email set.
const APP_IDENTITY = {
  GIT_AUTHOR_NAME: APP_NAME,
  GIT_AUTHOR_EMAIL: `${APP_NAME}@localhost`,
  GIT_COMMITTER_NAME: APP_NAME,
  GIT_COMMITTER_EMAIL: `${APP_NAME}@localhost`,
};

/** Runs git with hooks and prompts off; returns stdout, trimmed. Throws if it fails. */
export async function git(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<string> {
  const { stdout } = await exec(
    "git",
    // Long paths: a worktree's node_modules can pass Windows' 260 characters.
    [
      "-c",
      "core.hooksPath=/dev/null",
      // Nothing in a repository's config runs a program on these calls.
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.longpaths=true",
      ...args,
    ],
    {
      cwd,
      env: {
        // Offline, an SSH remote gives up in seconds rather than minutes.
        GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=10",
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        ...env,
      },
      maxBuffer: 256 * 1024 * 1024,
      // A fetch or pull that hangs on the network mustn't hold an agent up.
      timeout: 120_000,
    },
  );
  return stdout.trim();
}

/** Like `git`, but null when it fails. */
export const gitOr = (cwd: string, args: string[]) =>
  git(cwd, args).catch(() => null);

/** The ref under which a conversation's work is kept while it has no worktree. */
export const stateRef = (id: string) => `refs/${APP_NAME}/sessions/${id}`;

/** The worktree for conversation `id` in the repository at `repo`. */
export function worktreePath(repo: string, id: string, root = WORKTREES) {
  const hash = createHash("sha256").update(repo).digest("hex").slice(0, 8);
  return join(root, `${basename(repo)}-${hash}`, id);
}

/**
 * The tree of `dir`'s working state (tracked and untracked files, not ignored
 * ones), staged in `indexFile` instead of its index. Reusing one `indexFile`
 * keeps its stat cache, so only files changed since are hashed again.
 */
export async function workingTree(
  dir: string,
  indexFile: string,
): Promise<string> {
  const env = { GIT_INDEX_FILE: indexFile };
  const fresh = await access(indexFile).then(
    () => false,
    () => true,
  );
  if (fresh) {
    // A copy of the real index starts with its stat cache.
    const index = await git(dir, [
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      "index",
    ]);
    await copyFile(index, indexFile).catch(() =>
      git(dir, ["read-tree", "HEAD"], env),
    );
  }
  await git(dir, ["add", "-A", ":/"], env);
  return git(dir, ["write-tree"], env);
}

/**
 * Commits `dir`'s working state on top of its HEAD, without touching its
 * index or any branch.
 */
export async function snapshot(
  dir: string,
  message = `${APP_NAME} snapshot`,
): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), `${APP_NAME}-index-`));
  try {
    const tree = await workingTree(dir, join(tmp, "index"));
    return await git(
      dir,
      ["commit-tree", tree, "-p", "HEAD", "-m", message],
      APP_IDENTITY,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** Makes `dir`'s files match `state` while its index stays at HEAD, as uncommitted changes. */
export async function restore(dir: string, state: string) {
  await git(dir, ["read-tree", "-u", "--reset", state]);
  await git(dir, ["reset", "-q"]);
}

// A worktree's .git file names its private git dir; that dir's commondir file
// names the repository's own .git.
function gitDirs(worktree: string) {
  const line = readFileSync(join(worktree, ".git"), "utf8").trim();
  const own = resolve(worktree, line.replace(/^gitdir:\s*/, ""));
  const common = readFileSync(join(own, "commondir"), "utf8").trim();
  return { own, common: isAbsolute(common) ? common : resolve(own, common) };
}

/** Why a worktree is locked (`git worktree lock --reason`), or null. */
export function lockReason(worktree: string): string | null {
  try {
    return readFileSync(join(gitDirs(worktree).own, "locked"), "utf8").trim();
  } catch {
    return null;
  }
}

/** The agent's worktree that `dir` is in, or null. */
function worktreeOf(dir: string, root = WORKTREES): string | null {
  const rel = relative(root, dir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  const [repoKey, id] = rel.split(/[\\/]/);
  return repoKey && id ? join(root, repoKey, id) : null;
}

/** The repository a worktree belongs to, or null when its link is broken. */
export function repoOf(worktree: string): string | null {
  try {
    return dirname(gitDirs(worktree).common);
  } catch {
    return null;
  }
}

/**
 * The file beside a repository's worktrees naming its checkout, which git's
 * own links can't tell when the user's folder is a linked worktree or a
 * submodule. Agents can't write it.
 */
export const repoFile = (worktree: string) => join(dirname(worktree), ".repo");

/** The user's folder an agent's `dir` stands for: itself unless it's in a worktree. */
export function folderOf(dir: string, root = WORKTREES): string {
  const worktree = worktreeOf(dir, root);
  if (!worktree) return dir;
  let repo: string | null;
  try {
    repo = readFileSync(repoFile(worktree), "utf8").trim();
  } catch {
    repo = repoOf(worktree);
  }
  return repo ? join(repo, relative(worktree, dir)) : dir;
}

// The pointers say which repository (and so which config) git uses there; a
// sandboxed command rewriting them could make the next unsandboxed git call
// read a config of its own, which can run programs.
/**
 * For a `dir` in an agent's worktree, what git may write outside it (the
 * worktree's private git dir, the shared objects) and what stays read-only
 * inside (the `.git` file and the private dir's pointers). Empty otherwise.
 */
export function gitAccess(
  dir: string,
  root = WORKTREES,
): { allow: string[]; deny: string[] } {
  const worktree = worktreeOf(dir, root);
  if (!worktree) return { allow: [], deny: [] };
  try {
    const { own, common } = gitDirs(worktree);
    return {
      allow: [own, join(common, "objects")],
      deny: [
        join(worktree, ".git"),
        ...["commondir", "gitdir", "config.worktree", "locked"].map((f) =>
          join(own, f),
        ),
      ],
    };
  } catch {
    return { allow: [], deny: [] };
  }
}
