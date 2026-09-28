/** What a commit or push would change, and a file's diff, for the app's review. */
import { resolve } from "node:path";
import type { GitChange, GitReview } from "../shared/git.ts";
import { validRange } from "../shared/git.ts";
import { splitGit } from "../src/lib/gitPolicy.ts";
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
export async function changes(
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

// ponytail: compares HEAD with its upstream (or origin's default branch),
// whatever remote or refspec the push names.
async function pushReview(repo: string): Promise<GitReview> {
  const head = (await git(repo, ["rev-parse", "HEAD"]))?.trim();
  const base =
    (await git(repo, ["rev-parse", "@{upstream}"])) ??
    (await git(repo, ["rev-parse", "origin/HEAD"]));
  if (!head || !base) return { kind: "push", repo, range: "HEAD", files: [] };
  const range = `${base.trim()}...${head}`;
  const log = await git(repo, [
    "log",
    "--format=%h%x09%s",
    range.replace("...", ".."),
  ]);
  const commits = (log ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, ...subject] = line.split("\t");
      return { hash, subject: subject.join("\t") };
    });
  return {
    kind: "push",
    repo,
    range,
    files: await changes(repo, range),
    commits,
  };
}

/** What a commit or push call would change, for the user to review. */
export function review(
  kind: "commit" | "push",
  args: string[],
  cwd: string,
): Promise<GitReview> {
  const { dir, rest } = splitGit(args);
  const repo = dir ? resolve(cwd, dir) : cwd;
  return kind === "commit" ? commitReview(repo, rest) : pushReview(repo);
}

/** After a commit ran, its review points at the new commit, so its diffs stay. */
export async function committed(before: GitReview): Promise<GitReview> {
  const head = (await git(before.repo, ["rev-parse", "HEAD"]))?.trim();
  return head ? { ...before, range: `${head}^!` } : before;
}

/** One file's diff in a review's range, with the whole file for context. */
export async function fileDiff(repo: string, range: string, path: string) {
  if (!validRange(range)) throw new Error(`Not a diff range: ${range}`);
  const args = ["diff", "--no-color", "--no-ext-diff", "-U100000"];
  const diff = await git(repo, [...args, ...rangeArgs(range), "--", path]);
  if (diff === null) throw new Error(`Couldn't diff ${path}.`);
  return diff;
}
