/**
 * How an agent uses git: where it works (its own worktree, or the user's own
 * checkouts), and how its work reaches the user: a branch and a pull request
 * per repository, never merged or pushed to the default branch by itself.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GH_TOOL, GIT_TOOL } from "../shared/git.ts";
import { folderOf, gitOr } from "./worktreeGit.ts";

export const GIT_GUIDANCE = `## Using git
Run git and GitHub commands with the ${GIT_TOOL} and ${GH_TOOL} tools, one command per call; in a folder with several repositories, name the one you mean with -C <repo>.
Deliver work as a pull request, one per repository you changed:
1. Look first: \`status\`, \`branch --show-current\`, and \`log --oneline -5\` for the commit message style.
2. Create a branch named for the change (e.g. fix/realtime-toast) and commit to it. Stage your own files by path; don't use -a or \`add .\` when the tree has changes that aren't yours.
3. Push it with \`push -u origin <branch>\` (or commit with the ${GIT_TOOL} tool's \`push: true\` to commit and push in one call), then open the pull request with \`pr create\`. While that pull request is open, later changes to it are more commits pushed to the same branch. Once it's merged, the branch is done: start the next change on a new branch from the freshly fetched default branch, even if the repository is still on the old one.
4. Stop there. Don't merge the pull request, merge into or push the default branch, or pull the default branch into yours, unless the user asks.
Never force push, rewrite pushed history, or delete branches. If a push is rejected, say why and stop.`;

const SHARED = `You work in the user's own folder: its repositories are the user's checkouts. Before you create a branch in one, note the branch it's on; leave their uncommitted changes out of your commits, and switch back to that branch once your pull request is open.`;

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
    const where =
      folder === ctx.cwd
        ? SHARED
        : guidance(
            ctx.cwd,
            folder,
            (await gitOr(folder, ["branch", "--show-current"])) || null,
          );
    return {
      systemPrompt: `${event.systemPrompt}\n\n${GIT_GUIDANCE}\n\n${where}`,
    };
  });
}
