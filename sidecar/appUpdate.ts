/**
 * The app's own version and updates: it runs from a git checkout, so its
 * version is the checked-out commit and updating is a pull.
 */
import { execFile } from "node:child_process";
import { basename, dirname, relative } from "node:path";
import { promisify } from "node:util";
import type { AppVersion } from "../shared/hostProtocol.ts";
import { APPS } from "./appBuild.ts";
import { readState, stageUpdate, writeState } from "./appVersions.ts";
import { pnpmInstall } from "./pnpm.ts";

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

/** Whether `root` is a version the launcher built, not a clone run with `tauri dev`. */
const isVersion = (root: string, apps: string) =>
  relative(apps, dirname(root)) === "";

async function stagedUpdate(root: string, stage: typeof stageUpdate) {
  let warning: string | undefined;
  const staged =
    (await stage(root, process.env.IGNITE_MODS ?? "", (text) => {
      warning = text;
    })) ?? (await readState("next"));
  const ready = !!staged && staged !== basename(root);
  return { updated: false, ready, ...(warning && { warning }) };
}

/**
 * Run from the launcher, builds the latest code to run on the next start;
 * `ready` once one waits. Otherwise pulls it (fast-forward only, so local
 * work is never merged over) and reinstalls dependencies when the lockfile changed.
 */
export async function appUpdate(
  root = appRoot(),
  install = pnpmInstall,
  stage = stageUpdate,
  apps = APPS,
): Promise<{ updated: boolean; ready?: boolean; warning?: string }> {
  if (isVersion(root, apps)) return stagedUpdate(root, stage);
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
    "pnpm-lock.yaml",
  ]);
  if (changed) await install(root);
  return { updated: true };
}

/** Tells the launcher to start the app again once it quits. */
export const appRestart = () => writeState("restart", "1");
