/**
 * Setup's checks before it downloads anything: room on the disk ~/.ignite and
 * pnpm's store live on, and npm's registry and GitHub in reach, when it has
 * something to download; and a clone whose repository was renamed follows it.
 * Only Node's own modules, so they run before the packages are in.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statfsSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";
import { lockHash } from "./appPackages.ts";

const GB = 1024 ** 3;
// The first install's packages and a version's build, with room to spare.
const NEEDED = GB;
const HOSTS = ["https://registry.npmjs.org", "https://github.com"];

const git = (clone: string, args: string[]) =>
  execFileSync("git", args, { cwd: clone, encoding: "utf8" }).trim();

/** Whether setup has nothing to download: this lockfile's packages and this commit's version are in. */
export async function readyToRun(clone: string, home: string) {
  const ignite = join(home, `.${APP_NAME}`);
  const hash = await lockHash(clone).catch(() => "");
  const head = (() => {
    try {
      return git(clone, ["rev-parse", "HEAD"]);
    } catch {
      return "";
    }
  })();
  return (
    existsSync(join(ignite, "packages", hash, "ok")) &&
    existsSync(join(ignite, "app", head, "build", "ok"))
  );
}

// Free bytes on the disk holding `dir`.
function freeBytes(dir: string) {
  const { bavail, bsize } = statfsSync(dir);
  return bavail * bsize;
}

/** Why setup can't download what it needs, or null: too little room, or a host out of reach. */
export async function preflight(
  home: string,
  { get = fetch, free = freeBytes } = {},
): Promise<string | null> {
  const room = free(home);
  if (room < NEEDED)
    return `It needs about 1 GB free on the disk with your home folder, and has ${(room / GB).toFixed(1)} GB.`;
  for (const host of HOSTS) {
    const reached = await get(host, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
    }).catch((error: Error) => error);
    if (reached instanceof Error) {
      const cause = (reached.cause as { code?: string } | undefined)?.code;
      return `It can't reach ${new URL(host).host} (${cause ?? reached.message}); check your connection.`;
    }
  }
  return null;
}

/** `url` with its GitHub owner/name replaced by `fullName`, as the same kind of URL (SSH or HTTPS). */
export function renamedUrl(url: string, fullName: string) {
  return url.replace(
    /(github\.com[:/])[^/]+\/[^/]+?(\.git)?$/i,
    (_, host: string, dotGit = "") => `${host}${fullName}${dotGit}`,
  );
}

/**
 * Points the clone's origin at its repository's current name, when GitHub
 * says it was renamed (redirects work, but checks of CI's binary use the name);
 * says so, or returns null. Offline, it leaves the origin as it is.
 */
export async function followRename(clone: string, get = fetch) {
  let url: string;
  try {
    url = git(clone, ["remote", "get-url", "origin"]);
  } catch {
    return null;
  }
  const name = /github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/i.exec(url)?.[1];
  if (!name) return null;
  const response = await get(`https://api.github.com/repos/${name}`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const { full_name } = (await response.json().catch(() => ({}))) as {
    full_name?: string;
  };
  if (!full_name || full_name.toLowerCase() === name.toLowerCase()) return null;
  git(clone, ["remote", "set-url", "origin", renamedUrl(url, full_name)]);
  return `The repository is now ${full_name}; this clone's origin follows it.`;
}
