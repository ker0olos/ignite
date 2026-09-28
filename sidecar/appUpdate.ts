/**
 * The app's own version and updates: it runs from a git checkout, so its
 * version is the checked-out commit and updating is a pull.
 */
import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { AppVersion } from "../shared/hostProtocol.ts";

const run = promisify(execFile);

/** The checkout the app runs from; the sidecar is started as `node <root>/sidecar/main.ts`. */
export const appRoot = () => dirname(dirname(process.argv[1]));

async function git(root: string, args: string[]): Promise<string> {
  try {
    return (await run("git", args, { cwd: root })).stdout.trim();
  } catch (error) {
    const { stderr } = error as { stderr?: string };
    throw new Error(stderr?.trim() || (error as Error).message, {
      cause: error,
    });
  }
}

/** The commit the app runs from. */
export async function appVersion(root = appRoot()): Promise<AppVersion> {
  const out = await git(root, ["log", "-1", "--format=%H%n%cI%n%s"]);
  const [sha, date, ...subject] = out.split("\n");
  return { sha, date, subject: subject.join("\n") };
}

const npmCi = (root: string) =>
  run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: root }).then(() => {});

/**
 * Pulls the latest code (fast-forward only, so local work is never merged
 * over) and reinstalls dependencies when the lockfile changed.
 */
export async function appUpdate(
  root = appRoot(),
  install = npmCi,
): Promise<{ updated: boolean }> {
  const before = await git(root, ["rev-parse", "HEAD"]);
  await git(root, ["pull", "--ff-only", "--quiet"]);
  const after = await git(root, ["rev-parse", "HEAD"]);
  if (before === after) return { updated: false };
  const changed = await git(root, [
    "diff",
    "--name-only",
    before,
    after,
    "--",
    "package-lock.json",
  ]);
  if (changed) await install(root);
  return { updated: true };
}
