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
import { autonomous } from "../shared/tasks.ts";
import {
  ghApproval,
  gitApproval,
  splitGit,
  taskRunsAlone,
} from "../src/lib/gitPolicy.ts";
import { DENIED } from "./approvalExtension.ts";
import { askUser } from "./approvalAsk.ts";
import { askInTurn, askingLine, type Turn } from "./askingLine.ts";
import { approvalMode } from "./approvalSettings.ts";
import { loadBashParser } from "./bashParser.ts";
import { createsPr, reported, type Tool } from "./gitDelivery.ts";
import { refuseMerged } from "./gitMerged.ts";
import {
  THEN_PARAMS,
  marked,
  pushAfter,
  pushed,
  thenReason,
  type Then,
} from "./gitPush.ts";
import { resultText, run } from "./gitRun.ts";
import { committed, headOf, repoOf, review, updated } from "./gitReview.ts";
import { askTask } from "./taskExtension.ts";
import { gitOr } from "./worktreeGit.ts";

const Params = Type.Object({
  args: Type.Array(Type.String(), {
    description:
      'The arguments, one per item, without the program name: ["push", "-u", "origin", "main"].',
  }),
});

const GitParams = Type.Object({ ...Params.properties, ...THEN_PARAMS });

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

const opensPr = (tool: Tool, args: string[], then?: Then) =>
  createsPr(tool, args) || !!then?.pr;

// A task's agent commits and pushes its own branch without asking; its
// pull request still waits for review (gitPolicy's taskRunsAlone).
async function taskMayRun(
  pi: Pick<ExtensionAPI, "events">,
  args: string[],
  cwd: string,
) {
  if (!autonomous(await askTask(pi, "get"))) return false;
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
  then?: Then,
) {
  const mode = await approvalMode();
  if (mode === "full") return null;
  const place = { cwd, home: homedir() };
  const auto =
    tool === GIT_TOOL ? gitApproval(args, place) : ghGate(args, place);
  const manual = mode === "manual";
  if (manual) return { auto, manual, alone: false };
  if (!auto) return null;
  const alone = !!auto.review && (await runsAlone(pi, args, cwd, then));
  return { auto, manual, alone };
}

// A task's pull request always waits for review.
async function runsAlone(
  pi: Pick<ExtensionAPI, "events">,
  args: string[],
  cwd: string,
  then?: Then,
) {
  if (then?.pr || !(await taskMayRun(pi, args, cwd))) return false;
  return !then?.push || taskMayRun(pi, then.push, cwd);
}

// Without the parser, a rough split into commands is enough to spot git and gh.
const roughWords = (command: string) =>
  command.split(/[;&|()\n`]+/).map((part) => part.trim().split(/\s+/));

// A task's declined pull request waits on its card; in a conversation the user follows, it was declined in front of them.
async function refusal(pi: Pick<ExtensionAPI, "events">, declinedPr: boolean) {
  if (!declinedPr || !autonomous(await askTask(pi, "get"))) return DENIED;
  await askTask(pi, "update", { declined: true });
  return PR_DECLINED;
}

type GateCall = {
  cwd: string;
  toolCallId: string;
  turn: Turn;
  signal?: AbortSignal;
  then?: Then;
};

export default function gitTools(pi: ExtensionAPI) {
  const takeTurn = askingLine();

  /** Asks if it must; resolves to whether it may run, with its review. */
  async function gate(tool: Tool, args: string[], call: GateCall) {
    const { cwd, toolCallId, turn, signal, then } = call;
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
    const { approved, declined, reason } = await askInTurn(turn, () =>
      askUser(pi, request, signal),
    );
    return { allowed: approved, declined, reason, asked: true, shown };
  }

  function register(tool: Tool, description: string) {
    pi.registerTool({
      name: tool,
      label: tool,
      description,
      parameters: tool === GIT_TOOL ? GitParams : Params,
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        const { args } = params;
        const turn = takeTurn();
        const { then, gated } = await (async () => {
          await refuseMerged(tool, args, ctx.cwd, signal);
          const then = await pushAfter(params, ctx.cwd);
          const at = { cwd: ctx.cwd, toolCallId, turn, signal, then };
          return { then, gated: await gate(tool, args, at) };
        })().finally(turn.done);
        if (!gated.allowed) {
          const declinedPr = !!gated.declined && opensPr(tool, args, then);
          throw new Error(gated.reason ?? (await refusal(pi, declinedPr)));
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
        const done = await pushed(ran, then, {
          cwd: ctx.cwd,
          signal,
          hooks: gated.asked,
        });
        const text = await reported(pi, tool, args, done, then, ctx.cwd);
        return {
          content: [{ type: "text", text }],
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
      "a commit or push shows the user its changes and waits for approval. " +
      "To deliver, commit with `pr` to commit, push and open the pull request under one approval " +
      "(already committed: push with `pr`).",
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
