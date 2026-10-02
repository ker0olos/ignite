/** The git repositories a conversation worked in, and what of its work isn't committed, pushed or merged. */
import { dirname, resolve } from "node:path";
import type {
  AgentMessage,
  AssistantMessage,
  ToolCall,
} from "../shared/agentTypes.ts";
import {
  GIT_TOOL,
  type GitRepoDetails,
  type GitRepoStatus,
} from "../shared/git.ts";
import { gh } from "./gitMerged.ts";
import { placeOf } from "./gitPlace.ts";
import type { HostContext } from "./hostTypes.ts";
import { changes, commitsIn, repoOf } from "./gitReview.ts";
import { untrackedChanges } from "./gitUntracked.ts";
import { CHANGES_FILES } from "./taskSteps.ts";
import { gitOr } from "./worktreeGit.ts";

// gh asks GitHub; the app polls every few seconds.
const PR_TTL_MS = 30_000;

const toolCalls = (messages: AgentMessage[]): ToolCall[] =>
  messages
    .filter((m): m is AssistantMessage => m.role === "assistant")
    .flatMap((m) => m.content)
    .filter((b): b is ToolCall => b.type === "toolCall");

/** The folders a conversation's git calls ran in and its edits wrote to, with `workdir` first. */
export function touchedDirs(
  messages: AgentMessage[],
  workdir: string,
): string[] {
  const dirs = new Set([workdir]);
  for (const { name, arguments: a } of toolCalls(messages)) {
    if (name === GIT_TOOL && Array.isArray(a.args)) {
      dirs.add(repoOf(a.args as string[], workdir));
    } else if (CHANGES_FILES.has(name) && typeof a.path === "string") {
      dirs.add(dirname(resolve(workdir, a.path)));
    }
  }
  return [...dirs];
}

// Only found roots are kept: a folder may not exist yet, or become a repository later.
const roots = new Map<string, string>();
async function rootOf(dir: string): Promise<string | null> {
  const known = roots.get(dir);
  if (known) return known;
  const top = (await gitOr(dir, ["rev-parse", "--show-toplevel"]))?.trim();
  if (top) roots.set(dir, top);
  return top || null;
}

type Pr = NonNullable<GitRepoStatus["pr"]> & { isCrossRepository: boolean };

type PrEntry = {
  at: number;
  /** Set once GitHub first answered; kept when a later ask fails. */
  known?: { pr: GitRepoStatus["pr"] };
  asking?: Promise<GitRepoStatus["pr"]>;
};
const prs = new Map<string, PrEntry>();

async function askPr(repo: string, branch: string, entry: PrEntry) {
  const args = ["pr", "list", "--head", branch, "--state", "all", "--limit"];
  const fields = "number,url,state,isDraft,isCrossRepository";
  const list = await gh<Pr[]>([...args, "10", "--json", fields], repo);
  // --head matches forks' branches of the same name too.
  const own = list?.find((p) => !p.isCrossRepository);
  if (list) {
    entry.known = {
      pr: own && {
        number: own.number,
        url: own.url,
        state: own.state,
        isDraft: own.isDraft,
      },
    };
  }
  entry.at = Date.now();
  entry.asking = undefined;
  return entry.known?.pr;
}

/** The branch's latest pull request: the last known one at once, asked of GitHub again in the background after 30 seconds. */
function prOf(repo: string, branch: string) {
  const key = `${repo}\n${branch}`;
  const entry = prs.get(key) ?? { at: 0 };
  prs.set(key, entry);
  if (!entry.asking && Date.now() - entry.at >= PR_TTL_MS) {
    entry.asking = askPr(repo, branch, entry);
  }
  return entry.known ? Promise.resolve(entry.known.pr) : entry.asking;
}

async function unpushed(repo: string): Promise<number> {
  if (!(await gitOr(repo, ["remote"]))?.trim()) return 0;
  const count = await gitOr(repo, [
    "rev-list",
    "--count",
    "HEAD",
    "--not",
    "--remotes",
  ]);
  return Number(count?.trim()) || 0;
}

async function statusOf(repo: string): Promise<GitRepoStatus> {
  const [place, porcelain, ahead, remoteHead] = await Promise.all([
    placeOf(repo),
    // Without it, status may lock the index and fail the agent's own git call.
    gitOr(repo, ["--no-optional-locks", "status", "--porcelain", "-uall"]),
    unpushed(repo),
    gitOr(repo, ["rev-parse", "--abbrev-ref", "origin/HEAD"]),
  ]);
  const { name, branch } = place;
  const feature = branch && remoteHead?.trim() !== `origin/${branch}`;
  const pr = feature ? await prOf(repo, branch) : undefined;
  return {
    repo,
    name,
    ...(branch && { branch }),
    changed: porcelain?.split("\n").filter(Boolean).length ?? 0,
    unpushed: ahead,
    ...(pr && { pr }),
  };
}

/** Each repository the conversation worked in (its workdir's first), as it stands now. */
export async function gitStatus(
  messages: AgentMessage[],
  workdir: string,
): Promise<GitRepoStatus[]> {
  const found = await Promise.all(touchedDirs(messages, workdir).map(rootOf));
  const repos = [...new Set(found)].filter((r): r is string => !!r);
  return Promise.all(repos.map(statusOf));
}

/** An open conversation's repositories; none before it opens. */
export async function conversationGitStatus(
  ctx: HostContext,
  session: string,
): Promise<GitRepoStatus[]> {
  const agent = ctx.agents.get(session);
  // Until it opens, workdir is still the user's folder, not its worktree.
  if (!agent?.session) return [];
  return gitStatus(agent.session.messages, agent.workdir);
}

/** A repository's uncommitted files (new ones included) and the commits no remote has. */
export async function repoDetails(repo: string): Promise<GitRepoDetails> {
  const [tracked, untracked, remotes] = await Promise.all([
    changes(repo, "HEAD"),
    untrackedChanges(repo),
    gitOr(repo, ["remote"]),
  ]);
  const commits = remotes?.trim()
    ? await commitsIn(repo, ["HEAD", "--not", "--remotes"])
    : [];
  return { files: [...tracked, ...untracked], commits };
}
