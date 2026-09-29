/**
 * The git and gh tools: run outside the sandbox with the user's credentials,
 * so pushing, pulling, cloning and GitHub work. They ask for themselves (the
 * approval extension leaves them alone): Auto asks as src/lib/gitPolicy.ts
 * says, Manual for every call. A commit or push waits with its changes for
 * review. The same commands in bash are sent to these tools.
 */
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { GH_TOOL, GIT_TOOL, type GitReview } from "../shared/git.ts";
import type { ApprovalRequest } from "../shared/hostProtocol.ts";
import { ghApproval, gitApproval, splitGit } from "../src/lib/gitPolicy.ts";
import {
  APPROVAL_EVENT,
  DENIED,
  approvalMode,
  type ApprovalAsk,
} from "./approvalExtension.ts";
import { loadBashParser } from "./bashParser.ts";
import { resultText, run } from "./gitRun.ts";
import { committed, headOf, repoOf, review, updated } from "./gitReview.ts";
import { folderOf } from "./worktreeGit.ts";
import { updateFolder } from "./worktrees.ts";

const Params = Type.Object({
  args: Type.Array(Type.String(), {
    description:
      'The arguments, one per item, without the program name: ["push", "-u", "origin", "main"].',
  }),
});

// Subcommands that need the user's credentials, or their review.
const REDIRECTED = new Set([
  "commit",
  "push",
  "pull",
  "fetch",
  "clone",
  "ls-remote",
]);

export const USE_TOOLS =
  `Run git ${[...REDIRECTED].join(", ")} with the ${GIT_TOOL} tool, and gh with the ${GH_TOOL} tool: ` +
  "they have the user's credentials, and a commit or push shows the user its changes.";

/** Whether a bash command runs git that needs the git tool, or gh. */
export function needsTools(words: string[][]): boolean {
  return words.some(([program, ...args]) => {
    if (program === "gh") return true;
    return program === "git" && REDIRECTED.has(splitGit(args).command ?? "");
  });
}

const bashParser = loadBashParser().catch(() => undefined);

type Tool = typeof GIT_TOOL | typeof GH_TOOL;

// Subcommands that may move HEAD; the row then shows what they brought in.
const MOVES_HEAD = new Set([
  "pull",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
]);

/** HEAD before a git call that may move it, to compare with after. */
async function headBefore(tool: Tool, args: string[], cwd: string) {
  if (tool !== GIT_TOOL || !MOVES_HEAD.has(splitGit(args).command ?? "")) {
    return null;
  }
  const repo = repoOf(args, cwd);
  const head = await headOf(repo);
  return head ? { repo, head } : null;
}

/** What the row shows after a successful call. */
async function shownAfter(
  approved: GitReview | undefined,
  before: { repo: string; head: string } | null,
) {
  if (approved?.kind === "commit") return committed(approved);
  if (!before) return approved;
  const after = await headOf(before.repo);
  return after && after !== before.head
    ? updated(before.repo, before.head, after)
    : undefined;
}

function ghGate(
  args: string[],
  place: { cwd: string; home: string },
): { reason: string; review?: "commit" | "push" | "pr" } | null {
  const reason = ghApproval(args, place);
  if (!reason) return null;
  const creates = args[0] === "pr" && args[1] === "create";
  return creates ? { reason, review: "pr" } : { reason };
}

/** Whether a call puts the agent's work on the remote: a push, or a merged pull request. */
export function delivers(tool: Tool, args: string[]): boolean {
  if (tool === GH_TOOL) return args[0] === "pr" && args[1] === "merge";
  return splitGit(args).command === "push";
}

// An agent in its own worktree: the user's folder follows the remote when it can.
async function afterDelivery(tool: Tool, args: string[], cwd: string) {
  const folder = folderOf(cwd);
  return folder !== cwd && delivers(tool, args) ? updateFolder(folder) : null;
}

// Without the parser, a rough split into commands is enough to spot git and gh.
const roughWords = (command: string) =>
  command.split(/[;&|()\n`]+/).map((part) => part.trim().split(/\s+/));

export default function gitTools(pi: ExtensionAPI) {
  const ask = (request: ApprovalRequest, signal?: AbortSignal) =>
    new Promise<boolean>((resolve) => {
      signal?.addEventListener("abort", () => resolve(false));
      pi.events.emit(APPROVAL_EVENT, {
        request,
        answer: resolve,
      } satisfies ApprovalAsk);
    });

  /** Asks if it must; resolves to whether it may run, with its review. */
  async function gate(
    tool: Tool,
    args: string[],
    cwd: string,
    toolCallId: string,
    signal?: AbortSignal,
  ) {
    const place = { cwd, home: homedir() };
    const auto =
      tool === GIT_TOOL ? gitApproval(args, place) : ghGate(args, place);
    const manual = (await approvalMode()) === "manual";
    if (!auto && !manual) return { allowed: true, asked: false };
    const shown = auto?.review && (await review(auto.review, args, cwd));
    const request = {
      toolCallId,
      ...(auto && !manual && !shown && { reason: auto.reason }),
      ...(shown && { review: shown }),
    };
    return { allowed: await ask(request, signal), asked: true, shown };
  }

  function register(tool: Tool, description: string) {
    pi.registerTool({
      name: tool,
      label: tool,
      description,
      parameters: Params,
      async execute(toolCallId, { args }, signal, _onUpdate, ctx) {
        const gated = await gate(tool, args, ctx.cwd, toolCallId, signal);
        if (!gated.allowed) throw new Error(DENIED);
        const before = await headBefore(tool, args, ctx.cwd);
        const result = await run(tool, args, {
          cwd: ctx.cwd,
          signal,
          hooks: gated.asked,
        });
        const text = resultText(result);
        if (result.code !== 0) throw new Error(text);
        const shown = await shownAfter(gated.shown, before);
        const note = await afterDelivery(tool, args, ctx.cwd);
        return {
          content: [{ type: "text", text: note ? `${text}\n\n${note}` : text }],
          details: shown satisfies GitReview | undefined,
        };
      },
    });
  }

  register(
    GIT_TOOL,
    "Run git in the project with the user's credentials (SSH keys, credential helpers), " +
      "outside the sandbox. Use it for commit, push, pull, fetch, clone and other git commands; " +
      "use -C <dir> for a repository in a subfolder. Reads and local changes run at once; " +
      "a commit or push shows the user its changes and waits for approval.",
  );
  register(
    GH_TOOL,
    "Run the GitHub CLI (gh) with the user's login: read pull requests, their comments " +
      "and reviews (gh pr view --comments, gh api repos/{owner}/{repo}/pulls/N/comments), " +
      "issues and checks; create or change them after the user approves.",
  );

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const { command } = event.input as { command?: unknown };
    if (typeof command !== "string") return;
    const pipelines = (await bashParser)?.(command);
    const words = pipelines?.flat().map((c) => c.words) ?? roughWords(command);
    if (needsTools(words)) return { block: true, reason: USE_TOOLS };
  });
}
