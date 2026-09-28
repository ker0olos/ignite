/**
 * What `gh pr create` would open, for the user's review: its title, body,
 * branches, and the commits and files GitHub compares between them.
 */
import type { GitChange, GitReview } from "../shared/git.ts";
import { run } from "./gitRun.ts";

async function gh(cwd: string, args: string[]): Promise<string | null> {
  const { output, code } = await run("gh", args, { cwd });
  return code === 0 ? output.trim() : null;
}

async function gitHead(cwd: string): Promise<string | null> {
  const { output, code } = await run(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd },
  );
  return code === 0 ? output.trim() : null;
}

// `gh pr create` options that take a value, by every name they go by.
const OPTIONS: Record<string, string> = {
  "-t": "title",
  "--title": "title",
  "-b": "body",
  "--body": "body",
  "-B": "base",
  "--base": "base",
  "-H": "head",
  "--head": "head",
  "-R": "repo",
  "--repo": "repo",
  "-F": "bodyFile",
  "--body-file": "bodyFile",
};

/** The options `gh pr create` was given, and whether it's a draft or filled from commits. */
export function readPrCreate(args: string[]) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const [name, inline] = args[i].split(/=(.*)/s, 2);
    const key = OPTIONS[name];
    if (key) values[key] = inline ?? args[++i] ?? "";
    else flags.add(name);
  }
  return {
    values,
    draft: flags.has("-d") || flags.has("--draft"),
    fill: [...flags].some((f) => f.startsWith("--fill") || f === "-f"),
  };
}

const STATUS: Record<string, GitChange["status"]> = {
  added: "A",
  removed: "D",
  modified: "M",
  renamed: "M",
  changed: "M",
  copied: "A",
};

type Compare = {
  files?: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  commits?: { sha: string; commit: { message: string } }[];
};

async function compare(cwd: string, repo: string, base: string, head: string) {
  const json = await gh(cwd, [
    "api",
    `repos/${repo}/compare/${base}...${head}`,
  ]);
  const found = json ? (JSON.parse(json) as Compare) : {};
  const files = (found.files ?? []).map((f) => ({
    path: f.filename,
    status: STATUS[f.status] ?? "M",
    added: f.additions,
    removed: f.deletions,
  }));
  const commits = (found.commits ?? []).reverse().map((c) => ({
    hash: c.sha.slice(0, 7),
    subject: c.commit.message.split("\n")[0],
  }));
  return { files, commits };
}

const NAME = [
  "repo",
  "view",
  "--json",
  "nameWithOwner",
  "-q",
  ".nameWithOwner",
];

/** The repository and branches: as given, else the folder's repo, its default branch and the current one. */
async function branches(pr: Record<string, string>, cwd: string) {
  const repo = pr.repo ?? (await gh(cwd, NAME)) ?? "";
  const defaultBranch = () =>
    gh(cwd, ["api", `repos/${repo}`, "-q", ".default_branch"]);
  const base = pr.base ?? (repo ? await defaultBranch() : null) ?? "";
  const head = pr.head ?? (await gitHead(cwd)) ?? "";
  return { repo, base, head };
}

/** The pull request a `gh pr create` call would open. */
export async function prReview(
  args: string[],
  cwd: string,
): Promise<GitReview> {
  const { values: pr, draft, fill } = readPrCreate(args.slice(2));
  const { repo, base, head } = await branches(pr, cwd);
  const known = repo && base && head;
  const found = known
    ? await compare(cwd, repo, base, head)
    : { files: [], commits: [] };
  const title = pr.title ?? (fill ? "From the commits" : "");
  const body = pr.body ?? (pr.bodyFile ? `(from ${pr.bodyFile})` : "");
  return {
    kind: "pr",
    repo: cwd,
    range: `gh:${repo}:${base}...${head}`,
    ...found,
    pr: { repo, base, head, title, body, draft },
  };
}

/** One file's patch in a pull request's comparison on GitHub. */
export async function prFileDiff(cwd: string, range: string, path: string) {
  const [, repo, spec] = /^gh:([^:]+):(.+)$/.exec(range) ?? [];
  const diff = await gh(cwd, [
    "api",
    `repos/${repo}/compare/${spec}`,
    "-H",
    "Accept: application/vnd.github.diff",
  ]);
  if (diff === null) throw new Error(`Couldn't get the diff of ${path}.`);
  const sections = diff.split(/^(?=diff --git )/m);
  return sections.find((s) => s.startsWith(`diff --git a/${path} `)) ?? "";
}
