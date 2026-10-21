/** The git tool's `push: true` and `pr`: a commit that pushes its branch, and opens a pull request from it, in the same call and approval. */
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
      "With a commit only: push the branch, then open this pull request from it, all under one approval. " +
      "Use it to deliver; when the branch already has an open pull request, the commit is pushed to it.",
  },
);

export type PrParams = Static<typeof PrParams>;

/** The git tool's parameters for what follows a commit. */
export const THEN_PARAMS = {
  push: Type.Optional(
    Type.Boolean({
      description:
        "With a commit only: push the branch to origin (push -u origin <branch>) right after, under the same approval.",
    }),
  ),
  pr: Type.Optional(PrParams),
};

/** What follows a commit: its push, then (`pr`) gh's arguments for the pull request, unless one is already `open`. */
export type Then = {
  push: string[];
  branch: string;
  repo: string;
  pr?: string[];
  shown?: NonNullable<GitReview["pr"]>;
  open?: string;
  /** The branch's commits before this one, which the pull request also holds. */
  earlier?: { hash: string; subject: string }[];
};

type Repo = { nameWithOwner: string; defaultBranchRef: { name: string } };

const NO_GH =
  "Can't open a pull request: gh couldn't read this repository on GitHub (not signed in, no GitHub remote, or no answer). Nothing was committed.";

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

/** What follows a commit's call, if asked; throws, before the commit runs, when it can't. */
export async function pushAfter(
  params: { args: string[]; push?: boolean; pr?: PrParams },
  cwd: string,
): Promise<Then | undefined> {
  if (!params.push && !params.pr) return undefined;
  const { globals, command, dir } = splitGit(params.args);
  if (command !== "commit") {
    throw new Error("push: true and pr go only with a commit.");
  }
  if (!onlyDirs(globals)) {
    throw new Error("push: true and pr take no git options but -C <dir>.");
  }
  const repo = repoOf(params.args, cwd);
  const branch = await gitOr(repo, ["branch", "--show-current"]);
  if (!branch) {
    throw new Error(
      "HEAD isn't on a branch: create one, then commit with push: true or pr.",
    );
  }
  const at = dir === undefined ? [] : ["-C", dir];
  const push = [...at, "push", "-u", "origin", branch];
  const then = { push, branch, repo };
  return params.pr
    ? { ...then, ...(await prAfter(params.pr, repo, branch)) }
    : then;
}

/** A commit's review, naming the branch it pushes to and the pull request it opens. */
export function marked(review: GitReview | undefined, then?: Then) {
  if (!review || !then) return review;
  return {
    ...review,
    push: then.branch,
    ...(then.shown && { pr: then.shown }),
    ...(then.earlier?.length && { commits: then.earlier }),
  };
}

/** Why a call waits, naming what follows it. */
export const thenReason = (reason: string, then?: Then) => {
  if (!then) return reason;
  const pr = then.pr ? " and open a pull request" : "";
  return `${reason}, then push to origin/${then.branch}${pr}`;
};

type RunOptions = { cwd: string; signal?: AbortSignal; hooks: boolean };

/** What a commit's call did: its output, the pull request it's on, and whether opening one failed (after the push landed). */
export type Pushed = { text: string; pr?: string; failed?: boolean };

const alreadyOpen = (text: string, pr: string) => ({
  text: `${text}\n\nIts pull request is already open: ${pr}`,
  pr,
});

/** Runs the push, then the pull request, after its commit ran; a failed push throws. */
export async function pushed(
  committed: string,
  then: Then | undefined,
  options: RunOptions,
): Promise<Pushed> {
  if (!then) return { text: committed };
  const result = await run("git", then.push, options);
  const text = `${committed}\n\n${resultText(result)}`;
  if (result.code !== 0) {
    throw new Error(`Committed, but the push failed:\n\n${text}`);
  }
  if (then.open) return alreadyOpen(text, then.open);
  return then.pr ? openAfterPush(text, then.pr, then, options) : { text };
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
      text: `Committed and pushed, but opening the pull request failed:\n\n${all}`,
      failed: true,
    };
  }
  return { text: all, pr: prUrl(output) ?? undefined };
}
