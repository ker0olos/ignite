/**
 * The app's binary from the GitHub release CI made for its src-tauri/ tree
 * (.github/workflows/binary.yml), refused when its attestation shows that
 * workflow didn't build it from main (attestation.ts), used with a warning
 * when GitHub or Sigstore can't be reached to check.
 */
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { verifyAttestation } from "./attestation.ts";
import { git, remoteName } from "./worktreeGit.ts";

const WORKFLOW = ".github/workflows/binary.yml";
// CI builds the four platforms in about 20 minutes; a release still missing later never comes.
const CI_MINUTES = 60;

/** Each machine's binary in a release; binary.yml's matrix publishes the same names. */
export const ASSETS: Record<string, string> = {
  "darwin-arm64": "ignite-darwin-arm64",
  "darwin-x64": "ignite-darwin-x64",
  "linux-x64": "ignite-linux-x64",
  "win32-x64": "ignite-windows-x64.exe",
};
const here = ASSETS[`${process.platform}-${process.arch}`] ?? null;

/** The GitHub owner/name of a remote URL, or null for any other host. */
export function githubRepo(url: string): string | null {
  const host = /^(?:[a-z+]+:\/\/(?:[^@/]*@)?|[^@/:]+@)([^/:]+)/i.exec(url);
  return host?.[1].toLowerCase() === "github.com" ? remoteName(url) : null;
}

const attested = (file: string, repo: string) =>
  verifyAttestation(file, repo, WORKFLOW);

const originRepo = (repoDir: string) =>
  git(repoDir, ["remote", "get-url", "origin"])
    .then(githubRepo)
    .catch(() => null);

const treeOf = (repoDir: string, rev: string) =>
  git(repoDir, ["rev-parse", `${rev}:src-tauri`]);

const releaseUrl = (repo: string, tree: string, asset: string) =>
  `https://github.com/${repo}/releases/download/bin-${tree}/${asset}`;

/**
 * A downloaded binary, verified unless `warning` says why it couldn't be; or
 * why there's none and it must be built.
 */
type Download = { file: string; warning?: string } | { why: string };

// The repository to download from, or why there's nothing to download.
async function source(
  dir: string,
  asset: string | null,
): Promise<{ why: string } | { repo: string; asset: string }> {
  if (!asset) return { why: "CI builds no binary for this machine" };
  const repo = await originRepo(dir);
  return repo
    ? { repo, asset }
    : { why: "this clone's origin isn't on GitHub" };
}

// Keeps the downloaded file unless its attestation check fails; one that can't run only warns.
async function keepVerified(
  response: Response,
  file: string,
  repo: string,
  verify: typeof attested,
): Promise<Download> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  await chmod(file, 0o755);
  try {
    const unchecked = await verify(file, repo);
    if (!unchecked) return { file };
    return { file, warning: `Using CI's binary unverified: ${unchecked}.` };
  } catch (error) {
    await rm(file, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    return { why: `its attestation didn't verify: ${reason}` };
  }
}

/** Downloads and verifies the binary for checkout `dir`'s src-tauri/ into `into`. */
export async function downloadBinary(
  dir: string,
  into: string,
  { get = fetch as typeof fetch, verify = attested } = {},
  asset: string | null = here,
): Promise<Download> {
  const from = await source(dir, asset);
  if ("why" in from) return from;
  const url = releaseUrl(from.repo, await treeOf(dir, "HEAD"), from.asset);
  const signal = AbortSignal.timeout(300_000);
  const response = await get(url, { signal }).catch(() => null);
  if (!response?.ok) return { why: "CI hasn't published one for this version" };
  return keepVerified(response, join(into, from.asset), from.repo, verify);
}

/**
 * Whether commit `sha` of the clone changes the Rust side of the running
 * checkout `from`, and CI is likely still building its binary: none is
 * published yet, and the commit is under an hour old. Updates wait for it.
 */
export async function awaitingCI(
  clone: string,
  from: string,
  sha: string,
  get: typeof fetch = fetch,
  now = Date.now(),
  asset: string | null = here,
): Promise<boolean> {
  const repo = asset && (await originRepo(clone));
  if (!repo) return false;
  const [tree, running] = await Promise.all([
    treeOf(clone, sha).catch(() => null),
    treeOf(from, "HEAD").catch(() => null),
  ]);
  if (!tree || tree === running) return false;
  const signal = AbortSignal.timeout(30_000);
  const response = await get(releaseUrl(repo, tree, asset), {
    method: "HEAD",
    signal,
  }).catch(() => null);
  if (!response || response.ok) return false;
  const committed = Number(
    await git(clone, ["log", "-1", "--format=%ct", sha]),
  );
  return now - committed * 1000 < CI_MINUTES * 60_000;
}
