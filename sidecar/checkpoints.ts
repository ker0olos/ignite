/**
 * Each conversation's files as they were before each of its user messages,
 * kept as commits under refs of their own, so editing a message can put
 * its worktree back as it was then.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { git, gitOr, snapshot, workingTree } from "./worktreeGit.ts";

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

/** Makes `dir`'s tracked and untracked files match commit `state` (ignored ones stay), its index at HEAD. */
export async function restoreState(dir: string, state: string) {
  const top = await git(dir, ["rev-parse", "--show-toplevel"]);
  const tmp = await mkdtemp(join(tmpdir(), `${APP_NAME}-index-`));
  const index = join(tmp, "index");
  try {
    // Staged with the untracked files first, so read-tree removes those that `state` lacks, deleting nothing if it fails.
    await workingTree(top, index);
    await git(top, ["read-tree", "-u", "--reset", state], {
      GIT_INDEX_FILE: index,
    });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  await git(top, ["reset", "-q"]);
}

/** Restores the checkpoint of message `entry` (see restoreState); false when there's none. */
export async function restoreCheckpoint(
  dir: string,
  id: string,
  entry: string,
) {
  const ref = checkpointRef(id, entry);
  const state = await gitOr(dir, ["rev-parse", "-q", "--verify", ref]);
  if (!state) return false;
  await restoreState(dir, state);
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
