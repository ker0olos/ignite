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
import { prUrl } from "../shared/tasks.ts";
import {
  ghApproval,
  gitApproval,
  splitGit,
  taskRunsAlone,
} from "../src/lib/gitPolicy.ts";
import {
  APPROVAL_EVENT,
  DENIED,
  approvalMode,
  type ApprovalAsk,
} from "./approvalExtension.ts";
import { loadBashParser } from "./bashParser.ts";
import { marked, pushAfter, pushed, thenReason } from "./gitPush.ts";
import { resultText, run } from "./gitRun.ts";
import { committed, headOf, repoOf, review, updated } from "./gitReview.ts";
import { askTask } from "./taskExtension.ts";
import { folderOf, gitOr } from "./worktreeGit.ts";
import { updateFolder } from "./worktrees.ts";

const Params = Type.Object({
  args: Type.Array(Type.String(), {
    description:
      'The arguments, one per item, without the program name: ["push", "-u", "origin", "main"].',
  }),
});

const GitParams = Type.Object({
  ...Params.properties,
  push: Type.Optional(
    Type.Boolean({
      description:
        "With a commit only: push the branch to origin (push -u origin <branch>) right after, under the same approval.",
    }),
  ),
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

export const PR_DECLINED =
  "The user declined this pull request. Stop here: they'll update the task and tell you what to change.";

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
  return createsPr(GH_TOOL, args) ? { reason, review: "pr" } : { reason };
}

const createsPr = (tool: Tool, args: string[]) =>
  tool === GH_TOOL && args[0] === "pr" && args[1] === "create";

// A task's agent commits and pushes its own branch without asking; its
// pull request still waits for review (gitPolicy's taskRunsAlone).
async function taskMayRun(
  pi: Pick<ExtensionAPI, "events">,
  args: string[],
  cwd: string,
) {
  if (!(await askTask(pi, "get"))) return false;
  // The repository the call runs in, which -C may name.
  const repo = repoOf(args, cwd);
  const [current, remoteHead] = await Promise.all([
    gitOr(repo, ["branch", "--show-current"]),
    gitOr(repo, ["rev-parse", "--abbrev-ref", "origin/HEAD"]),
  ]);
  const defaultBranch = remoteHead?.replace(/^origin\//, "") || null;
  return taskRunsAlone(args, current || null, defaultBranch);
}

// What a call waits on: Manual, or Auto's rule unless a task may run it; null runs it.
async function waitsOn(
  pi: Pick<ExtensionAPI, "events">,
  tool: Tool,
  args: string[],
  cwd: string,
  then?: string[],
) {
  const place = { cwd, home: homedir() };
  const auto =
    tool === GIT_TOOL ? gitApproval(args, place) : ghGate(args, place);
  const manual = (await approvalMode()) === "manual";
  if (manual) return { auto, manual, alone: false };
  if (!auto) return null;
  const alone =
    !!auto.review &&
    (await taskMayRun(pi, args, cwd)) &&
    (!then || (await taskMayRun(pi, then, cwd)));
  return { auto, manual, alone };
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
  // "declined" only when the user answered no; a stop or close is "denied".
  const ask = (request: ApprovalRequest, signal?: AbortSignal) =>
    new Promise<"approved" | "denied" | "declined">((resolve) => {
      signal?.addEventListener("abort", () => resolve("denied"));
      pi.events.emit(APPROVAL_EVENT, {
        request,
        answer: (approved) => resolve(approved ? "approved" : "denied"),
        declined: () => resolve("declined"),
      } satisfies ApprovalAsk);
    });

  /** Asks if it must; resolves to whether it may run, with its review. */
  async function gate(
    tool: Tool,
    args: string[],
    cwd: string,
    toolCallId: string,
    signal?: AbortSignal,
    then?: string[],
  ) {
    const waits = await waitsOn(pi, tool, args, cwd, then);
    if (!waits) return { allowed: true, asked: false };
    const { auto, manual, alone } = waits;
    // Taken before it runs, so the row shows what a task's commit or push changed.
    const reviewed = auto?.review && (await review(auto.review, args, cwd));
    const shown = marked(reviewed, then);
    if (alone) return { allowed: true, asked: false, shown };
    const request = {
      toolCallId,
      ...(auto &&
        !manual &&
        !shown && { reason: thenReason(auto.reason, then) }),
      ...(shown && { review: shown }),
    };
    const answer = await ask(request, signal);
    return {
      allowed: answer === "approved",
      declined: answer === "declined",
      asked: true,
      shown,
    };
  }

  function register(tool: Tool, description: string) {
    pi.registerTool({
      name: tool,
      label: tool,
      description,
      parameters: tool === GIT_TOOL ? GitParams : Params,
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        const { args } = params;
        const then = await pushAfter(params, ctx.cwd);
        const gated = await gate(tool, args, ctx.cwd, toolCallId, signal, then);
        if (!gated.allowed) {
          const task =
            gated.declined &&
            createsPr(tool, args) &&
            (await askTask(pi, "update", { declined: true }));
          throw new Error(task ? PR_DECLINED : DENIED);
        }
        const before = await headBefore(tool, args, ctx.cwd);
        const result = await run(tool, args, {
          cwd: ctx.cwd,
          signal,
          hooks: gated.asked,
        });
        const ran = resultText(result);
        if (result.code !== 0) throw new Error(ran);
        const shown = await shownAfter(gated.shown, before);
        const text = await pushed(ran, then, {
          cwd: ctx.cwd,
          signal,
          hooks: gated.asked,
        });
        const note = await afterDelivery(tool, then ?? args, ctx.cwd);
        const pr = createsPr(tool, args) && prUrl(text);
        if (pr) void askTask(pi, "update", { pr });
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
