/** What a commit or push would change, and a file's diff, for the app's review. */
import { resolve } from "node:path";
import type { GitChange, GitReview } from "../shared/git.ts";
import { validRange } from "../shared/git.ts";
import { splitGit } from "../src/lib/gitPolicy.ts";
import { prFileDiff, prReview } from "./ghReview.ts";
import { run } from "./gitRun.ts";

async function git(repo: string, args: string[]): Promise<string | null> {
  const { output, code } = await run("git", ["-C", repo, ...args], {
    cwd: repo,
  });
  return code === 0 ? output : null;
}

/** git diff's arguments for a review range. */
function rangeArgs(range: string): string[] {
  if (range === "staged") return ["--cached"];
  return [range];
}

/** The files `range` changes, with line counts. Renames show as delete and add. */
async function changes(
  repo: string,
  range: string,
  paths: string[] = [],
): Promise<GitChange[]> {
  const base = ["diff", "--no-renames", "--no-ext-diff", ...rangeArgs(range)];
  const tail = paths.length ? ["--", ...paths] : [];
  const [statuses, counts] = await Promise.all([
    git(repo, [...base, "--name-status", ...tail]),
    git(repo, [...base, "--numstat", ...tail]),
  ]);
  const numbers = new Map<string, [number | null, number | null]>();
  for (const line of counts?.split("\n") ?? []) {
    const [added, removed, path] = line.split("\t");
    if (!path) continue;
    const n = (s: string) => (s === "-" ? null : Number(s));
    numbers.set(path, [n(added), n(removed)]);
  }
  return (statuses?.split("\n") ?? []).flatMap((line) => {
    const [status, path] = line.split("\t");
    if (!path) return [];
    const [added, removed] = numbers.get(path) ?? [null, null];
    return [{ path, status: status[0] as GitChange["status"], added, removed }];
  });
}

// Options of `git commit` that take the next word as their value.
const COMMIT_VALUES = new Set([
  "-m",
  "--message",
  "-F",
  "--file",
  "--author",
  "--date",
  "-C",
  "-c",
  "-t",
  "--template",
  "--fixup",
  "--squash",
  "--cleanup",
  "--trailer",
]);
const MESSAGE = new Set(["-m", "--message"]);
// -a, or -am "message": -a and -m together.
const ALL = /^(?:-a|--all|-[a-z]*a[a-z]*m)$/;

/** Whether a commit option takes the next word: its message, or another value. */
function takes(arg: string): "message" | "value" | null {
  if (MESSAGE.has(arg) || (ALL.test(arg) && arg.endsWith("m"))) {
    return "message";
  }
  return COMMIT_VALUES.has(arg) ? "value" : null;
}

/** A commit's message (its -m parts), whether it takes all tracked changes, and its paths. */
export function readCommit(rest: string[]) {
  const messages: string[] = [];
  const paths: string[] = [];
  let all = false;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--") {
      paths.push(...rest.slice(i + 1));
      break;
    }
    const inline = /^(?:--message=|-m(?=.))(.*)$/s.exec(arg);
    const next = takes(arg);
    if (inline) messages.push(inline[1]);
    else if (next) {
      const value = rest[++i] ?? "";
      if (next === "message") messages.push(value);
    } else if (!arg.startsWith("-")) paths.push(arg);
    all ||= ALL.test(arg);
  }
  return { message: messages.join("\n\n") || undefined, all, paths };
}

async function commitReview(repo: string, rest: string[]): Promise<GitReview> {
  const { message, all, paths } = readCommit(rest);
  const range = all || paths.length ? "HEAD" : "staged";
  const files = await changes(repo, range, paths);
  return { kind: "commit", repo, range, files, message };
}

/** The remote-tracking refs a push's target may already have, most specific first. */
export function pushTargets(rest: string[], current: string | null): string[] {
  const [remote = "origin", refspec] = rest.filter((a) => !a.startsWith("-"));
  const named = refspec?.replace(/^\+/, "").split(":").pop();
  const branch = (!named || named === "HEAD" ? current : named)?.replace(
    /^refs\/heads\//,
    "",
  );
  // A URL remote has no tracking refs to compare with.
  const tracked = !remote.includes("/") && branch;
  return [
    ...(tracked ? [`refs/remotes/${remote}/${branch}`] : []),
    "@{upstream}",
  ];
}

// What the remote has of the push's target; for a branch it doesn't have
// yet, the parent of the oldest commit no remote has.
async function pushBase(repo: string, rest: string[]) {
  const current = (await git(repo, ["branch", "--show-current"]))?.trim();
  for (const ref of pushTargets(rest, current || null)) {
    const base = await git(repo, ["rev-parse", "--verify", "--quiet", ref]);
    if (base) return base.trim();
  }
  const unpushed = await git(repo, [
    "rev-list",
    "--reverse",
    "HEAD",
    "--not",
    "--remotes",
  ]);
  const oldest = unpushed?.split("\n")[0];
  if (!oldest) return (await git(repo, ["rev-parse", "HEAD"]))?.trim();
  const parent = await git(repo, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${oldest}^`,
  ]);
  // The first push to an empty remote sends the root commit, which has none.
  return parent?.trim() ?? EMPTY_TREE;
}

// git's empty tree: what a diff against nothing compares with.
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

async function pushReview(repo: string, rest: string[]): Promise<GitReview> {
  const head = (await git(repo, ["rev-parse", "HEAD"]))?.trim();
  const base = await pushBase(repo, rest);
  if (!head || !base) return { kind: "push", repo, range: "HEAD", files: [] };
  const root = base === EMPTY_TREE;
  const range = root ? `${base}..${head}` : `${base}...${head}`;
  return {
    kind: "push",
    repo,
    range,
    files: await changes(repo, range),
    commits: await commitsIn(
      repo,
      root ? [head, "--not", "--remotes"] : [`${base}..${head}`],
    ),
  };
}

/** The commits `revs` name (e.g. `a..b`), newest first. */
async function commitsIn(repo: string, revs: string[]) {
  const log = await git(repo, ["log", "--format=%h%x09%s", ...revs]);
  return (log ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, ...subject] = line.split("\t");
      return { hash, subject: subject.join("\t") };
    });
}

/** The repository a git call runs in: its -C folder, or `cwd`. */
export function repoOf(args: string[], cwd: string): string {
  const { dir } = splitGit(args);
  return dir ? resolve(cwd, dir) : cwd;
}

/** The commit HEAD points at, or null outside a repository. */
export async function headOf(repo: string): Promise<string | null> {
  return (await git(repo, ["rev-parse", "HEAD"]))?.trim() || null;
}

/** What a pull, merge or rebase brought in, from HEAD before to HEAD after. */
export async function updated(
  repo: string,
  before: string,
  after: string,
): Promise<GitReview> {
  const range = `${before}..${after}`;
  return {
    kind: "update",
    repo,
    range,
    files: await changes(repo, range),
    commits: await commitsIn(repo, [range]),
  };
}

/** What a commit, push or new pull request would change, for the user to review. */
export function review(
  kind: "commit" | "push" | "pr",
  args: string[],
  cwd: string,
): Promise<GitReview> {
  if (kind === "pr") return prReview(args, cwd);
  const { rest } = splitGit(args);
  const repo = repoOf(args, cwd);
  return kind === "commit" ? commitReview(repo, rest) : pushReview(repo, rest);
}

/** After a commit ran, its review points at the new commit, so its diffs stay. */
export async function committed(before: GitReview): Promise<GitReview> {
  const head = (await git(before.repo, ["rev-parse", "HEAD"]))?.trim();
  return head ? { ...before, range: `${head}^!` } : before;
}

/** One file's diff in a review's range, with the whole file for context. */
export async function fileDiff(repo: string, range: string, path: string) {
  if (!validRange(range)) throw new Error(`Not a diff range: ${range}`);
  if (range.startsWith("gh:")) return prFileDiff(repo, range, path);
  const args = ["diff", "--no-color", "--no-ext-diff", "-U100000"];
  const diff = await git(repo, [...args, ...rangeArgs(range), "--", path]);
  if (diff === null) throw new Error(`Couldn't diff ${path}.`);
  return diff;
}
