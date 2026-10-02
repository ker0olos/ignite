/** Refuses new work on a branch whose pull request was already merged. */
import { GIT_TOOL } from "../shared/git.ts";
import { splitGit } from "../src/lib/gitPolicy.ts";
import { repoOf } from "./gitReview.ts";
import { run } from "./gitRun.ts";
import { gitOr } from "./worktreeGit.ts";

const GH_TIMEOUT_MS = 10_000;

type Pr = {
  number: number;
  state: string;
  baseRefName: string;
  headRefOid: string;
  mergeCommit: { oid: string } | null;
};

/** The local commit a call adds to, and the remote branch it lands on. */
async function target(args: string[], repo: string) {
  const { command, rest } = splitGit(args);
  if (command !== "commit" && command !== "push") return null;
  // `push origin feature` or `push origin src:dst` names it; otherwise HEAD's branch.
  const refspec =
    command === "push" ? rest.filter((a) => !a.startsWith("-"))[1] : undefined;
  if (refspec && refspec !== "HEAD") {
    const [src, dst = src] = refspec.split(":");
    return { local: src, branch: dst.replace(/^refs\/heads\//, "") };
  }
  const branch = (await gitOr(repo, ["branch", "--show-current"]))?.trim();
  return branch ? { local: "HEAD", branch } : null;
}

/** A gh command's JSON output, or null when it fails or takes over 10 seconds. */
export async function gh<T>(
  args: string[],
  repo: string,
  signal?: AbortSignal,
) {
  const timeout = AbortSignal.timeout(GH_TIMEOUT_MS);
  const listed = await run("gh", args, {
    cwd: repo,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }).catch(() => null);
  if (listed?.code !== 0) return null;
  try {
    return JSON.parse(listed.output) as T;
  } catch {
    return null;
  }
}

const contains = async (repo: string, commit: string, local: string) =>
  (await gitOr(repo, ["merge-base", "--is-ancestor", commit, local])) !== null;

/** The merged pull request `local` still continues: it holds that pull request's commits but not its merge. */
async function continuedMerge(prs: Pr[], repo: string, local: string) {
  for (const pr of prs) {
    if (pr.state !== "MERGED" || !pr.mergeCommit) continue;
    if (
      (await contains(repo, pr.headRefOid, local)) &&
      !(await contains(repo, pr.mergeCommit.oid, local))
    ) {
      return pr;
    }
  }
  return undefined;
}

/** Throws before a commit or push that continues a branch whose pull request was merged; goes ahead whenever that isn't clear. */
export async function refuseMerged(
  tool: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<void> {
  if (tool !== GIT_TOOL) return;
  const repo = repoOf(args, cwd);
  const at = await target(args, repo);
  if (!at) return;
  const remoteHead = await gitOr(repo, [
    "rev-parse",
    "--abbrev-ref",
    "origin/HEAD",
  ]);
  if (remoteHead?.trim() === `origin/${at.branch}`) return;
  const fields = "number,state,baseRefName,headRefOid,mergeCommit";
  const prs = await gh<Pr[]>(
    ["pr", "list", "--head", at.branch, "--state", "all", "--json", fields],
    repo,
    signal,
  );
  if (!prs || prs.some((pr) => pr.state === "OPEN")) return;
  const merged = await continuedMerge(prs, repo, at.local);
  if (!merged) return;
  // Others' pull requests target it: a long-lived branch like develop, not a finished one.
  const into = await gh<unknown[]>(
    [
      "pr",
      "list",
      "--base",
      at.branch,
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      "number",
    ],
    repo,
    signal,
  );
  if (!into || into.length > 0) return;
  throw new Error(
    `${at.branch}'s pull request #${merged.number} was already merged into ${merged.baseRefName}, so this work doesn't belong on it. ` +
      `Fetch, start a new branch named for this change from origin/${merged.baseRefName} (switch -c <name> origin/${merged.baseRefName}), and commit there; ` +
      `if you already committed here, carry the commits over with cherry-pick.`,
  );
}
