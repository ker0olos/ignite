/**
 * How an agent uses git: where it works (its own worktree, or the user's own
 * checkouts), and how its work reaches the user: a branch and a pull request
 * per repository, never merged or pushed to the default branch by itself.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GH_TOOL, GIT_TOOL } from "../shared/git.ts";
import { ASK_TOOL } from "../shared/questions.ts";
import { basename } from "node:path";
import { approvalMode } from "./approvalSettings.ts";
import { folderOf, gitOr, groupCheckouts, inGroupCopy } from "./worktreeGit.ts";

const REVIEW_ASKS = `When instructions say to do these only if asked, the ${GIT_TOOL} tool's review is that asking: it waits for the user before anything runs, so make the call with \`pr\` and let them approve or decline it there.`;

// Full access runs git calls without a review, so nothing would ask.
const ASK_FIRST = `When instructions say to do these only if asked, ask with the ${ASK_TOOL} tool first (or say so in your reply when it's unavailable): your git calls run without a review. Once they agree, make the call with \`pr\`.`;

/** How to use git and deliver work; `reviewed` when commits and pushes wait for the user's review. */
export const gitGuidance = (reviewed: boolean) => `## Using git
Run git and GitHub commands with the ${GIT_TOOL} and ${GH_TOOL} tools, one command per call; in a folder with several repositories, name the one you mean with -C <repo>.
Deliver work as a pull request, one per repository you changed:
1. Look first: \`status\`, \`branch --show-current\`, and \`log --oneline -5\` for the commit message style.
2. Create a branch named for the change (e.g. fix/realtime-toast) and commit to it. Stage your own files by path; don't use -a or \`add .\` when the tree has changes that aren't yours.
3. Commit with the ${GIT_TOOL} tool's \`pr\` (title and body) to commit, push and open the pull request in one call the user approves once. While that pull request is open, later changes to it are more commits pushed to the same branch (\`push: true\`). Once it's merged, the branch is done: start the next change on a new branch from the freshly fetched default branch, even if the repository is still on the old one.
4. Stop there. Never leave committing, pushing or opening the pull request to the user, with a command or link for them to run or an offer in your reply. ${reviewed ? REVIEW_ASKS : ASK_FIRST} Don't merge the pull request, merge into or push the default branch, or pull the default branch into yours, unless the user asks.
Never force push, rewrite pushed history, or delete branches. If a push is rejected, say why and stop.`;

/** CLAUDE.md, memories and the user name the user's folder; the agent must read them as its own copy. */
const samePaths = (cwd: string, folder: string) =>
  `Paths under ${folder} (in CLAUDE.md, memories or the user's messages) mean the same paths under ${cwd}: read, search, edit and run git there, never in ${folder}.`;

const SHARED = `You work in the user's own folder: its repositories are the user's checkouts. Before you create a branch in one, note the branch it's on; leave their uncommitted changes out of your commits, and switch back to that branch once your pull request is open.`;

/** The system prompt's note for an agent in `cwd`, a worktree of `folder`. */
export function guidance(cwd: string, folder: string, branch: string | null) {
  const checkedOut = branch
    ? ` Don't switch to ${branch}: it's checked out in the user's folder, and git allows a branch in one worktree only.`
    : "";
  return [
    `You work in your own git worktree at ${cwd}, a separate checkout of the user's repository at ${folder}.`,
    samePaths(cwd, folder),
    "Other agents may work in the same repository in their own worktrees. The user's folder and theirs are not yours to edit; nothing you change shows up in the user's folder until it's merged.",
    "Your worktree started from the latest default branch on the remote, with no branch checked out.",
    `To deliver your work, create a branch named for the task, commit, push and open a pull request with the git and gh tools.${checkedOut}`,
    "When your work is merged or pushed, the user's folder is brought up to date for you when that's safe; the tool result says whether it was.",
    "If dependencies or build outputs are missing here, install or build them in your worktree.",
  ].join(" ");
}

/** The system prompt's note for an agent in `cwd`, its own copy of the user's `folder`, whose `repos` are each its own worktree. */
export function groupGuidance(cwd: string, folder: string, repos: string[]) {
  return [
    `You work in your own copy of the user's folder at ${cwd}: the user's folder at ${folder} holds several repositories (${repos.join(", ")}), and each of them here is your own git worktree, a separate checkout of the user's.`,
    samePaths(cwd, folder),
    "Other agents may work in the same repositories in their own worktrees. The user's folder and theirs are not yours to edit; nothing you change shows up in the user's folder until it's merged.",
    "Each worktree started from its repository's latest default branch on the remote, with no branch checked out. Run git in one with -C <repo>, and gh with -R <owner/name> for it (gh pr create also with --head <branch>), since gh runs in this folder, which isn't a repository.",
    "To deliver your work, create a branch named for the task in each repository you changed, commit, push and open a pull request there with the git and gh tools.",
    "When your work is merged or pushed, the user's checkout of that repository is brought up to date for you when that's safe; the tool result says whether it was.",
    "The folder's other files here are copies: your changes to them aren't kept. If dependencies or build outputs are missing, install or build them in your worktree.",
  ].join(" ");
}

async function where(cwd: string) {
  const folder = folderOf(cwd);
  if (folder === cwd) return SHARED;
  if (inGroupCopy(cwd))
    return groupGuidance(
      cwd,
      folder,
      groupCheckouts(cwd).map((c) => basename(c)),
    );
  const branch = await gitOr(folder, ["branch", "--show-current"]);
  return guidance(cwd, folder, branch || null);
}

export default function worktreeGuidance(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    // A section, not added text: claude-bridge passes Claude Code only the prompt's sections.
    const reviewed = (await approvalMode()) !== "full";
    event.systemPromptOptions.sections.worktree = `${gitGuidance(reviewed)}\n\n${await where(ctx.cwd)}`;
  });
}
