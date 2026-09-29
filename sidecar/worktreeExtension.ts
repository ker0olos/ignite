/**
 * Tells an agent working in its own git worktree where it is and how its work
 * reaches the user: a branch, a pull request, and the user's folder brought
 * up to date once it's merged.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { folderOf, gitOr } from "./worktreeGit.ts";

/** The system prompt's note for an agent in `cwd`, a worktree of `folder`. */
export function guidance(cwd: string, folder: string, branch: string | null) {
  const checkedOut = branch
    ? ` Don't switch to ${branch}: it's checked out in the user's folder, and git allows a branch in one worktree only.`
    : "";
  return [
    `You work in your own git worktree at ${cwd}, a separate checkout of the user's repository at ${folder}.`,
    "Other agents may work in the same repository in their own worktrees. The user's folder and theirs are not yours to edit; nothing you change shows up in the user's folder until it's merged.",
    "Your worktree started from the latest default branch on the remote, with no branch checked out.",
    `To deliver your work, create a branch named for the task, commit, push and open a pull request with the git and gh tools.${checkedOut}`,
    "When your work is merged or pushed, the user's folder is brought up to date for you when that's safe; the tool result says whether it was.",
    "If dependencies or build outputs are missing here, install or build them in your worktree.",
  ].join(" ");
}

export default function worktreeGuidance(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const folder = folderOf(ctx.cwd);
    if (folder === ctx.cwd) return;
    const branch = await gitOr(folder, ["branch", "--show-current"]);
    return {
      systemPrompt: `${event.systemPrompt}\n\n${guidance(ctx.cwd, folder, branch || null)}`,
    };
  });
}
