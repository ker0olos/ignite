/** New files git doesn't track yet, which `git diff HEAD` leaves out: listed as added, and their diffs. */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { GitChange } from "../shared/git.ts";
import { run } from "./gitRun.ts";
import { gitOr } from "./worktreeGit.ts";

// A big generated folder left untracked would otherwise read every file.
const MAX_FILES = 200;
const MAX_BYTES = 1_000_000;

const listed = async (repo: string, paths: string[] = []) =>
  (
    await gitOr(repo, [
      "ls-files",
      "--others",
      "--exclude-standard",
      // Unquoted paths, whatever characters they hold.
      "-z",
      "--",
      ...paths,
    ])
  )
    ?.split("\0")
    .filter(Boolean) ?? [];

const small = async (file: string) =>
  ((await stat(file).catch(() => null))?.size ?? Infinity) <= MAX_BYTES;

async function lines(file: string): Promise<number | null> {
  if (!(await small(file))) return null;
  const text = await readFile(file).catch(() => null);
  if (!text || text.includes(0)) return null;
  if (text.length === 0) return 0;
  const count = text.toString().split("\n").length;
  return text.at(-1) === 0x0a ? count - 1 : count;
}

/** The repository's untracked files as added ones, with their line counts (null when binary or large). */
export async function untrackedChanges(repo: string): Promise<GitChange[]> {
  const paths = (await listed(repo)).slice(0, MAX_FILES);
  return Promise.all(
    paths.map(async (path) => ({
      path,
      status: "A" as const,
      added: await lines(join(repo, path)),
      removed: 0,
    })),
  );
}

/** An untracked file's whole content as an added diff, or null when `path` isn't one; throws for one over 1 MB. */
export async function untrackedDiff(repo: string, path: string) {
  if ((await listed(repo, [path]))[0] !== path) return null;
  if (!(await small(join(repo, path)))) {
    throw new Error(`${path} is too large to show.`);
  }
  const args = [
    "diff",
    "--no-color",
    "--no-ext-diff",
    "-U100000",
    "--no-index",
  ];
  const { output } = await run(
    "git",
    ["-C", repo, ...args, "--", "/dev/null", path],
    { cwd: repo },
  );
  return output;
}
