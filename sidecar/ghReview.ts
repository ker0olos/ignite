/**
 * What `gh pr create` would open, for the user's review: its title, body,
 * branches, and the commits and files GitHub compares between them; and
 * what `gh pr edit` would change in one's title and description.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

/** Whether a call is `gh pr edit` changing the title or description. */
export function editsPrText(args: string[]) {
  if (args[0] !== "pr" || args[1] !== "edit") return false;
  const { values } = readPrCreate(args.slice(2));
  return "title" in values || "body" in values || "bodyFile" in values;
}

// The pull request named in `pr edit`'s words: a word that's no option's value.
function prSelector(rest: string[]) {
  const takesValue = (flag = "") =>
    /^-[^=]*$/.test(flag) && flag !== "--remove-milestone";
  return rest.find(
    (a, i) => !a.startsWith("-") && (i === 0 || !takesValue(rest[i - 1])),
  );
}

type PrText = { number: number; title: string; body: string };

// gh's output also carries its stderr, so warnings may surround the JSON.
function readPr(output: string | null): PrText | null {
  const json = output?.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
  try {
    const pr = json ? (JSON.parse(json) as PrText) : null;
    return pr && { ...pr, body: pr.body.replace(/\r\n/g, "\n") };
  } catch {
    return null;
  }
}

async function textDiff(before: string, after: string) {
  const dir = await mkdtemp(join(tmpdir(), "ignite-pr-edit-"));
  try {
    await writeFile(join(dir, "before"), `${before}\n`);
    await writeFile(join(dir, "after"), `${after}\n`);
    const diff = ["diff", "--no-index", "--no-color", "--no-ext-diff"];
    const { output } = await run(
      "git",
      [...diff, "-U100000", "before", "after"],
      {
        cwd: dir,
      },
    );
    return output;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const prText = (title: string, body: string) => `# ${title}\n\n${body}`;

/** What a `gh pr edit` call changes: the pull request's title and description, as a diff; none when they can't be read. */
export async function prEditReview(
  args: string[],
  cwd: string,
): Promise<GitReview | undefined> {
  const rest = args.slice(2);
  const { values } = readPrCreate(rest);
  const pick = prSelector(rest);
  const repo = values.repo ? ["-R", values.repo] : [];
  const was = readPr(
    await gh(cwd, [
      "pr",
      "view",
      ...(pick ? [pick] : []),
      ...repo,
      "--json",
      "number,title,body",
    ]),
  );
  if (!was) return undefined;
  const file = values.bodyFile;
  const body =
    values.body ??
    (file
      ? await readFile(resolve(cwd, file), "utf8").catch(() => `(from ${file})`)
      : was.body);
  const diff = await textDiff(
    prText(was.title, was.body),
    prText(values.title ?? was.title, body.replace(/\r\n/g, "\n")),
  );
  const pr = `${values.repo ?? ""}#${was.number}`;
  return {
    kind: "pr_edit",
    repo: cwd,
    range: "",
    files: [],
    edit: { pr, diff },
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
