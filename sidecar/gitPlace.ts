import { basename } from "node:path";
import type { GitReview } from "../shared/git.ts";
import { run } from "./gitRun.ts";
import { folderOf, remoteName } from "./worktreeGit.ts";

async function git(repo: string, args: string[]): Promise<string> {
  const { output, code } = await run("git", ["-C", repo, ...args], {
    cwd: repo,
  });
  return code === 0 ? output.trim() : "";
}

/** Which repository and branch a review's git call runs in. */
export async function placeOf(
  repo: string,
): Promise<NonNullable<GitReview["place"]>> {
  const [url, branch] = await Promise.all([
    git(repo, ["remote", "get-url", "origin"]),
    git(repo, ["branch", "--show-current"]),
  ]);
  const name = remoteName(url) ?? basename(folderOf(repo));
  return { name, ...(branch && { branch }) };
}
