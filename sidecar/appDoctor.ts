/**
 * `npm run setup -- --check`: what setup set up, and what takes space in
 * ~/.ignite. Changes nothing and installs nothing, so it also runs before the
 * packages are in (only Node's own modules and theirs).
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME, APP_TITLE } from "../src/lib/app.ts";
import { launcherFiles, userData } from "./appLauncher.ts";
import { lockHash, pinned } from "./appPackages.ts";

/** One line of the report: whether it's fine, and what was found. */
export type Check = { ok: boolean; text: string };

type Place = {
  clone: string;
  home: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
};

const read = (file: string) => {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
};

function git(clone: string): Check {
  const origin = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: clone,
    encoding: "utf8",
  });
  if (origin.error) return { ok: false, text: "git isn't installed" };
  const url = origin.stdout.trim();
  return url
    ? { ok: true, text: `git, origin ${url}` }
    : { ok: false, text: "This clone has no origin to update from" };
}

async function packages({ clone, home }: Place): Promise<Check[]> {
  const ignite = join(home, `.${APP_NAME}`);
  const version = await pinned(clone).catch(() => null);
  const pnpm = version
    ? existsSync(join(ignite, "pnpm", version, "node_modules", "pnpm"))
      ? { ok: true, text: `pnpm ${version}, installed for ${APP_TITLE}` }
      : { ok: false, text: `pnpm ${version} isn't installed yet` }
    : { ok: false, text: "package.json pins no pnpm version" };
  const hash = await lockHash(clone).catch(() => null);
  const installed = !!hash && existsSync(join(ignite, "packages", hash, "ok"));
  const link = join(clone, "node_modules");
  const linked = lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink();
  const own =
    !linked && existsSync(link) ? "; this clone has its own copy too" : "";
  return [
    pnpm,
    installed
      ? { ok: true, text: `Packages for this lockfile installed${own}` }
      : { ok: false, text: "Packages for this lockfile aren't installed" },
  ];
}

function version(home: string): Check {
  const launch = join(home, `.${APP_NAME}`, "launch");
  const good = read(join(launch, "good"));
  const next = read(join(launch, "next"));
  const bad = read(join(launch, "bad"));
  if (!good && !next) return { ok: false, text: "No version has started yet" };
  const short = (sha: string) => sha.slice(0, 7);
  const parts = [
    good ? `Running ${short(good)}` : "Not started yet",
    next && next !== good ? `update ${short(next)} ready` : "",
    bad ? `${short(bad)} failed to start and is skipped` : "",
  ];
  return { ok: true, text: parts.filter(Boolean).join("; ") };
}

/** Whether setup's work is in place: Node, git, pnpm, the packages, the version, the launcher. */
export async function checks(place: Place): Promise<Check[]> {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const node = major > 22 || (major === 22 && minor >= 18);
  const { home, platform, env } = place;
  const launcher = launcherFiles(
    platform,
    home,
    userData(platform, home, env),
  ).shown;
  return [
    {
      ok: node,
      text: `Node ${process.versions.node}${node ? "" : ": needs 22.18 or newer"}`,
    },
    git(place.clone),
    ...(await packages(place)),
    version(place.home),
    existsSync(launcher)
      ? { ok: true, text: `Launcher at ${launcher}` }
      : { ok: false, text: `No launcher at ${launcher}: run npm run setup` },
  ];
}

/**
 * Bytes under `path`, links not followed, each file once across calls sharing
 * `seen` (pnpm hard-links its binary and, on Windows and Linux, the packages).
 * ponytail: APFS clones share blocks unseen, so the store and packages count twice on macOS.
 */
export function sizeOf(path: string, seen = new Set<string>()): number {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) {
    const file = `${stat.dev}:${stat.ino}`;
    if (seen.has(file)) return 0;
    seen.add(file);
    return stat.size;
  }
  let total = 0;
  for (const entry of readdirSync(path))
    total += sizeOf(join(path, entry), seen);
  return total;
}

/** "1.6 GB", "38 MB", "4 KB". */
export function human(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/** What's in ~/.ignite, largest first; app/ by version. */
export function space(home: string): [string, number][] {
  const ignite = join(home, `.${APP_NAME}`);
  const entries = existsSync(ignite) ? readdirSync(ignite) : [];
  const app = join(ignite, "app");
  const versions = existsSync(app) ? readdirSync(app) : [];
  const seen = new Set<string>();
  const sized: [string, number][] = [
    ...entries
      .filter((name) => name !== "app")
      .map((name): [string, number] => [
        name,
        sizeOf(join(ignite, name), seen),
      ]),
    ...versions.map((name): [string, number] => [
      `app/${name.length === 40 ? name.slice(0, 7) : name}`,
      sizeOf(join(app, name), seen),
    ]),
  ];
  return sized.sort((a, b) => b[1] - a[1]);
}
