/**
 * Each conversation's files as they were before each of its user messages,
 * kept as commits under refs of their own, so editing a message can put
 * its worktree back as it was then.
 */
import { APP_NAME } from "../src/lib/app.ts";
import { git, gitOr, restore, snapshot } from "./worktreeGit.ts";

const prefix = (id: string) => `refs/${APP_NAME}/checkpoints/${id}/`;

/** The ref under which conversation `id`'s files are kept as they were before message `entry`. */
export const checkpointRef = (id: string, entry: string) =>
  `${prefix(id)}${entry}`;

/** Commits `dir`'s working state (tracked and untracked files) without moving a branch; null when it can't. */
export const takeCheckpoint = (dir: string) =>
  snapshot(dir, `${APP_NAME} checkpoint`).catch(() => null);

/** Keeps `commit` as conversation `id`'s checkpoint for message `entry`; false when it can't. */
export async function keepCheckpoint(
  dir: string,
  id: string,
  entry: string,
  commit: string,
) {
  const kept = await gitOr(dir, [
    "update-ref",
    checkpointRef(id, entry),
    commit,
  ]);
  return kept !== null;
}

/**
 * Makes `dir`'s tracked and untracked files match the checkpoint of message
 * `entry` (ignored ones stay), its index at HEAD; false when there's none.
 */
export async function restoreCheckpoint(
  dir: string,
  id: string,
  entry: string,
) {
  const ref = checkpointRef(id, entry);
  const state = await gitOr(dir, ["rev-parse", "-q", "--verify", ref]);
  if (!state) return false;
  const top = await git(dir, ["rev-parse", "--show-toplevel"]);
  // Files added since aren't in the index, so read-tree alone would leave them.
  await git(top, ["clean", "-fdq"]);
  await restore(top, state);
  return true;
}

/** Deletes conversation `id`'s checkpoints in the repository at `repo`. */
export async function dropCheckpoints(repo: string, id: string) {
  const refs = await gitOr(repo, [
    "for-each-ref",
    "--format=%(refname)",
    prefix(id),
  ]);
  for (const ref of refs?.split("\n").filter(Boolean) ?? []) {
    await gitOr(repo, ["update-ref", "-d", ref]);
  }
}
