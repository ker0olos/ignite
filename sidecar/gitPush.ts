/** The git tool's `push: true`: a commit that pushes its branch in the same call and approval. */
import type { GitReview } from "../shared/git.ts";
import { onlyDirs, splitGit } from "../src/lib/gitPolicy.ts";
import { repoOf } from "./gitReview.ts";
import { resultText, run } from "./gitRun.ts";
import { gitOr } from "./worktreeGit.ts";

/** The push that follows a commit's call, if asked; throws, before the commit runs, when there can't be one. */
export async function pushAfter(
  params: { args: string[]; push?: boolean },
  cwd: string,
): Promise<string[] | undefined> {
  if (!params.push) return undefined;
  const { globals, command, dir } = splitGit(params.args);
  if (command !== "commit") {
    throw new Error("push: true goes only with a commit.");
  }
  if (!onlyDirs(globals)) {
    throw new Error("push: true takes no git options but -C <dir>.");
  }
  const branch = await gitOr(repoOf(params.args, cwd), [
    "branch",
    "--show-current",
  ]);
  if (!branch) {
    throw new Error(
      "HEAD isn't on a branch: create one, then commit with push: true.",
    );
  }
  const at = dir === undefined ? [] : ["-C", dir];
  return [...at, "push", "-u", "origin", branch];
}

/** A commit's review, naming the branch when the call pushes after it. */
export function marked(review: GitReview | undefined, then?: string[]) {
  return review && then ? { ...review, push: then.at(-1) } : review;
}

/** Why a call waits, naming the push that follows. */
export const thenReason = (reason: string, then?: string[]) =>
  then ? `${reason}, then push to origin/${then.at(-1)}` : reason;

/** Runs the push after its commit ran; a failed push still reports the commit. */
export async function pushed(
  committed: string,
  then: string[] | undefined,
  options: { cwd: string; signal?: AbortSignal; hooks: boolean },
) {
  if (!then) return committed;
  const result = await run("git", then, options);
  const text = `${committed}\n\n${resultText(result)}`;
  if (result.code !== 0) {
    throw new Error(`Committed, but the push failed:\n\n${text}`);
  }
  return text;
}
