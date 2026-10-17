/**
 * `npm run uninstall`: removes the launcher and what Ignite keeps
 * only to run (versions, packages, pnpm), and keeps what's the user's:
 * conversations and logins, settings, tasks, themes, lessons, mods, the
 * agents' Chrome profile and worktrees. `all` removes ~/.ignite entirely.
 * Only Node's own modules, so it works with the packages broken.
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { launcherFiles, userData } from "./appLauncher.ts";

// What Ignite keeps only to run; the rest of ~/.ignite is the user's.
const RUNTIME = [
  "app",
  "packages",
  "pnpm-store",
  "pnpm",
  "launch",
  "bin",
  "sigstore",
];

type Place = {
  clone: string;
  home: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
};

const folder = (home: string) => join(home, `.${APP_NAME}`);

/** What uninstalling removes, of what's there. */
export function uninstallTargets(place: Place, all = false) {
  const { home, platform, env } = place;
  const { shown } = launcherFiles(
    platform,
    home,
    userData(platform, home, env),
  );
  // The launch script is in ~/.ignite/bin, which goes with the rest.
  const ours = all ? [folder(home)] : RUNTIME.map((n) => join(folder(home), n));
  return [shown, ...ours].filter((path) => existsSync(path));
}

/** What uninstalling (without `all`) leaves in ~/.ignite. */
export function keptItems(home: string) {
  const dir = folder(home);
  return existsSync(dir)
    ? readdirSync(dir).filter((name) => !RUNTIME.includes(name))
    : [];
}

async function unlinkIfLink(path: string) {
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink())
    await unlink(path);
}

/** Removes the targets, the clone's link into the shared packages, and git's record of the versions' worktrees. */
export async function uninstall(place: Place, all = false) {
  // Links into the shared packages go first, so nothing deleting follows them (Windows junctions).
  await unlinkIfLink(join(place.clone, "node_modules"));
  const app = join(folder(place.home), "app");
  for (const version of existsSync(app) ? readdirSync(app) : [])
    await unlinkIfLink(join(app, version, "node_modules"));
  for (const target of uninstallTargets(place, all))
    await rm(target, { recursive: true, force: true });
  spawnSync("git", ["worktree", "prune"], { cwd: place.clone });
}
