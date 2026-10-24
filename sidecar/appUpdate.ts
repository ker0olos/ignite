/**
 * The app's own version and updates: it runs from a git checkout, so its
 * version is the checked-out commit and updating is a pull.
 */
import { execFile } from "node:child_process";
import { basename, dirname, relative } from "node:path";
import { promisify } from "node:util";
import type { AppUpdateResponses } from "../shared/appUpdate.ts";
import type { AppVersion, HostMessage } from "../shared/hostProtocol.ts";
import { APPS } from "./appBuild.ts";
import { readState, stageUpdate, writeState } from "./appVersions.ts";
import { linkPackages } from "./appPackages.ts";

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

/** The commit the app runs from, or another (`rev`) its checkout has. */
export async function appVersion(
  root = appRoot(),
  rev = "HEAD",
): Promise<AppVersion> {
  const out = await git(root, ["log", "-1", "--format=%H%n%cI%n%s", rev]);
  const [sha, date, ...subject] = out.split("\n");
  return { sha, date, subject: subject.join("\n") };
}

/** Whether `root` is a version the launcher built, not a clone run with `tauri dev`. */
const isVersion = (root: string, apps: string) =>
  relative(apps, dirname(root)) === "";

// A launcher version is a worktree of the user's clone, so it has the commits fetched there.
const versionOf = (root: string, sha: string) =>
  appVersion(root, sha).catch(() => undefined);

async function stagedUpdate(
  root: string,
  stage: typeof stageUpdate,
  installing: (version?: AppVersion) => void,
) {
  let warning: string | undefined;
  const warn = (text: string) => {
    warning = text;
  };
  const mods = process.env.IGNITE_MODS ?? "";
  const found = (sha: string) => void versionOf(root, sha).then(installing);
  const staged =
    (await stage(root, mods, warn, found)) ?? (await readState("next"));
  const ready = !!staged && staged !== basename(root);
  const next = ready ? await versionOf(root, staged) : undefined;
  return {
    updated: false,
    ready,
    ...(next && { next }),
    ...(warning && { warning }),
  };
}

/**
 * Run from the launcher, builds the latest code to run on the next start
 * (`installing`, with its commit, once it has found one); `ready` (and `next`,
 * its commit) once one waits. Otherwise pulls
 * it (fast-forward only, so local work is never merged over) and reinstalls
 * dependencies when the lockfile changed.
 */
export async function appUpdate({
  root = appRoot(),
  install = (dir: string) => linkPackages(dir, { keepOwn: true }),
  stage = stageUpdate,
  apps = APPS,
  installing = () => {},
}: {
  root?: string;
  install?: (dir: string) => Promise<unknown>;
  stage?: typeof stageUpdate;
  apps?: string;
  installing?: (version?: AppVersion) => void;
} = {}): Promise<AppUpdateResponses["app_update"]> {
  if (isVersion(root, apps)) return stagedUpdate(root, stage, installing);
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
const appRestart = () => writeState("restart", "1");

/** The host's version and update requests. */
export const appHandlers = {
  app_version: () => appVersion(),
  app_update: (ctx: {
    send(m: Extract<HostMessage, { type: "app_update_installing" }>): void;
  }) =>
    appUpdate({
      installing: (version) =>
        ctx.send({ type: "app_update_installing", version }),
    }),
  app_restart: () => appRestart(),
};
