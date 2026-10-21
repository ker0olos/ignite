/** The git tool's `push: true` and `pr`: a commit that pushes its branch, and a commit or push that opens a pull request from it, in the same call and approval. */
import { Type, type Static } from "typebox";
import type { GitReview } from "../shared/git.ts";
import { prUrl } from "../shared/tasks.ts";
import { onlyDirs, splitGit } from "../src/lib/gitPolicy.ts";
import { gh } from "./gitMerged.ts";
import { commitsIn, repoOf } from "./gitReview.ts";
import { resultText, run } from "./gitRun.ts";
import { gitOr } from "./worktreeGit.ts";

const PrParams = Type.Object(
  {
    title: Type.String(),
    body: Type.String(),
    base: Type.Optional(
      Type.String({ description: "Defaults to the default branch." }),
    ),
    draft: Type.Optional(Type.Boolean()),
  },
  {
    description:
      "With a commit or push: push the branch, then open this pull request from it, all under one approval. " +
      "Use it to deliver; when the branch already has an open pull request, it's only pushed.",
  },
);

export type PrParams = Static<typeof PrParams>;

/** The git tool's parameters for what follows a commit or push. */
export const THEN_PARAMS = {
  push: Type.Optional(
    Type.Boolean({
      description:
        "With a commit only: push the branch to origin (push -u origin <branch>) right after, under the same approval.",
    }),
  ),
  pr: Type.Optional(PrParams),
};

/** What follows a commit or push: the commit's push, then (`pr`) gh's arguments for the pull request, unless one is already `open`. */
export type Then = {
  push?: string[];
  branch: string;
  repo: string;
  pr?: string[];
  shown?: NonNullable<GitReview["pr"]>;
  open?: string;
  /** The branch's commits since the base (before a commit's own), which the pull request holds. */
  earlier?: { hash: string; subject: string }[];
};

type Repo = { nameWithOwner: string; defaultBranchRef: { name: string } };

const NO_GH =
  "Can't open a pull request: gh couldn't read this repository on GitHub (not signed in, no GitHub remote, or no answer). Nothing was committed or pushed.";

/** The branch's open pull request's URL, "" when it has none, null when gh can't tell. */
async function openPrOf(repo: string, branch: string) {
  const listed = await gh<{ url: string }[]>(
    ["pr", "list", "--head", branch, "--state", "open", "--json", "url"],
    repo,
  );
  return listed && (listed[0]?.url ?? "");
}

async function prAfter(
  pr: PrParams,
  repo: string,
  branch: string,
): Promise<Pick<Then, "pr" | "shown" | "open" | "earlier">> {
  const [open, found] = await Promise.all([
    openPrOf(repo, branch),
    gh<Repo>(
      ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"],
      repo,
    ),
  ]);
  if (open === null || !found) throw new Error(NO_GH);
  if (open) return { open };
  const shown = {
    repo: found.nameWithOwner,
    base: pr.base ?? found.defaultBranchRef.name,
    head: branch,
    title: pr.title,
    body: pr.body,
    draft: !!pr.draft,
  };
  const earlier = await commitsIn(repo, [`origin/${shown.base}..HEAD`]);
  return { pr: createArgs(shown), shown, earlier };
}

function createArgs(pr: NonNullable<GitReview["pr"]>) {
  return [
    "pr",
    "create",
    ...(pr.repo ? ["-R", pr.repo] : []),
    "--head",
    pr.head,
    ...(pr.base ? ["--base", pr.base] : []),
    "--title",
    pr.title,
    "--body",
    pr.body,
    ...(pr.draft ? ["--draft"] : []),
  ];
}

type ThenAsked = { args: string[]; push?: boolean; pr?: PrParams };

// The call's command, its arguments and -C, when something should follow it.
function asked(params: ThenAsked) {
  if (!params.push && !params.pr) return undefined;
  const { globals, command, rest, dir } = splitGit(params.args);
  if (params.push && command !== "commit") {
    throw new Error(
      "push: true goes only with a commit; to deliver what's already committed, push with pr.",
    );
  }
  if (command !== "commit" && command !== "push") {
    throw new Error("pr goes only with a commit or push.");
  }
  if (!onlyDirs(globals)) {
    throw new Error("push: true and pr take no git options but -C <dir>.");
  }
  return { pushing: command === "push", rest, dir };
}

const NOT_PUSHING = new Set([
  "-d",
  "--delete",
  "-n",
  "--dry-run",
  "--mirror",
  "--all",
  "--branches",
]);

// A push that sends the current branch, which the pull request opens from, and nothing else.
function pushesBranch(rest: string[], branch: string) {
  if (rest.some((arg) => NOT_PUSHING.has(arg))) return false;
  const refs = rest.filter((arg) => !arg.startsWith("-")).slice(1);
  const ok = [branch, "HEAD", `HEAD:${branch}`, `${branch}:${branch}`];
  return refs.every((ref) => ok.includes(ref.replace(/^\+/, "")));
}

/** What follows a commit's or push's call, if asked; throws, before it runs, when it can't. */
export async function pushAfter(
  params: ThenAsked,
  cwd: string,
): Promise<Then | undefined> {
  const call = asked(params);
  if (!call) return undefined;
  const { pushing, rest, dir } = call;
  const repo = repoOf(params.args, cwd);
  const branch = await gitOr(repo, ["branch", "--show-current"]);
  if (!branch) {
    throw new Error(
      "HEAD isn't on a branch: create one, then commit with push: true or pr (or push with pr).",
    );
  }
  if (pushing && !pushesBranch(rest, branch)) {
    throw new Error(
      `pr opens the pull request from the current branch, ${branch}: push only it (push -u origin ${branch}).`,
    );
  }
  const at = dir === undefined ? [] : ["-C", dir];
  const then = pushing
    ? { branch, repo }
    : { push: [...at, "push", "-u", "origin", branch], branch, repo };
  return params.pr
    ? { ...then, ...(await prAfter(params.pr, repo, branch)) }
    : then;
}

/** A commit's or push's review, naming the branch a commit pushes to and the pull request it opens. */
export function marked(review: GitReview | undefined, then?: Then) {
  if (!review || !then) return review;
  return {
    ...review,
    ...(then.push && { push: then.branch }),
    ...(then.shown && { pr: then.shown }),
    ...(then.earlier?.length && { commits: then.earlier }),
  };
}

/** Why a call waits, naming what follows it. */
export const thenReason = (reason: string, then?: Then) => {
  if (!then) return reason;
  if (!then.push) return `${reason}, then open a pull request`;
  const pr = then.pr ? " and open a pull request" : "";
  return `${reason}, then push to origin/${then.branch}${pr}`;
};

type RunOptions = { cwd: string; signal?: AbortSignal; hooks: boolean };

/** What a commit's or push's call did: its output, the pull request it's on, and whether opening one failed (after the push landed). */
export type Pushed = { text: string; pr?: string; failed?: boolean };

const alreadyOpen = (text: string, pr: string) => ({
  text: `${text}\n\nIts pull request is already open: ${pr}`,
  pr,
});

/** Runs a commit's push, then the pull request, after its call ran; a failed push throws. */
export async function pushed(
  ran: string,
  then: Then | undefined,
  options: RunOptions,
): Promise<Pushed> {
  if (!then) return { text: ran };
  const text = then.push ? await pushOf(ran, then.push, options) : ran;
  if (then.open) return alreadyOpen(text, then.open);
  return then.pr ? openAfterPush(text, then.pr, then, options) : { text };
}

async function pushOf(committed: string, push: string[], options: RunOptions) {
  const result = await run("git", push, options);
  const text = `${committed}\n\n${resultText(result)}`;
  if (result.code !== 0) {
    throw new Error(`Committed, but the push failed:\n\n${text}`);
  }
  return text;
}

async function openAfterPush(
  text: string,
  args: string[],
  then: Then,
  options: RunOptions,
): Promise<Pushed> {
  // Opened by hand while the call waited for approval.
  const now = await openPrOf(then.repo, then.branch);
  if (now) return alreadyOpen(text, now);
  const opened = await run("gh", args, { ...options, cwd: then.repo });
  const output = resultText(opened);
  const all = `${text}\n\n${output}`;
  if (opened.code !== 0) {
    return {
      text: `Pushed, but opening the pull request failed:\n\n${all}`,
      failed: true,
    };
  }
  return { text: all, pr: prUrl(output) ?? undefined };
}
