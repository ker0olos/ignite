/** After a git or gh call ran: the user's folder brought up to date, and a task's pull request recorded. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { GH_TOOL, GIT_TOOL } from "../shared/git.ts";
import { prUrl } from "../shared/tasks.ts";
import { splitGit } from "../src/lib/gitPolicy.ts";
import type { Pushed, Then } from "./gitPush.ts";
import { repoOf } from "./gitReview.ts";
import { askTask } from "./taskExtension.ts";
import { folderOf } from "./worktreeGit.ts";
import { ghDir } from "./worktreeGroup.ts";
import { updateFolder } from "./worktrees.ts";

export type Tool = typeof GIT_TOOL | typeof GH_TOOL;

/** Whether a call is `gh pr create`. */
export const createsPr = (tool: Tool, args: string[]) =>
  tool === GH_TOOL && args[0] === "pr" && args[1] === "create";

/** Whether a call puts the agent's work on the remote: a push, or a merged pull request. */
export function delivers(tool: Tool, args: string[]): boolean {
  if (tool === GH_TOOL) return args[0] === "pr" && args[1] === "merge";
  return splitGit(args).command === "push";
}

// An agent in its own worktree: the user's folder follows the remote when it can.
// In a copy of a folder of repositories, that's the checkout of the one delivered.
async function afterDelivery(tool: Tool, args: string[], cwd: string) {
  if (!delivers(tool, args)) return null;
  const dir = tool === GIT_TOOL ? repoOf(args, cwd) : await ghDir(args, cwd);
  const folder = folderOf(dir);
  return folder !== dir ? updateFolder(folder) : null;
}

/** The call's result text; the folder follows even when only opening the pull request failed, as the push landed. */
export async function reported(
  pi: Pick<ExtensionAPI, "events">,
  tool: Tool,
  args: string[],
  done: Pushed,
  then: Then | undefined,
  cwd: string,
) {
  const pr = then ? done.pr : createsPr(tool, args) && prUrl(done.text);
  if (pr) void askTask(pi, "update", { pr });
  const note = await afterDelivery(tool, then?.push ?? args, cwd);
  const text = note ? `${done.text}\n\n${note}` : done.text;
  if (done.failed) throw new Error(text);
  return text;
}
