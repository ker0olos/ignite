/**
 * The app's binary from the GitHub release CI made for its src-tauri/ tree
 * (.github/workflows/binary.yml), refused when its attestation shows that
 * workflow didn't build it from main (attestation.ts), used with a warning
 * when GitHub or Sigstore can't be reached to check.
 */
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

// Loaded when a binary is checked, not with the sidecar: sigstore is about 250 modules.
const attested = async (file: string, repo: string) =>
  (await import("./attestation.ts")).verifyAttestation(file, repo, WORKFLOW);

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

// The release's binary, or why there's none: not published, or the download failed.
async function fetchRelease(
  url: string,
  tree: string,
  get: typeof fetch,
): Promise<Response | { why: string }> {
  const signal = AbortSignal.timeout(300_000);
  const response = await get(url, { signal }).catch((error: Error) => error);
  if (response instanceof Error) {
    // fetch says only "fetch failed"; its cause names the network error.
    const cause = response.cause as
      { code?: string; message?: string } | undefined;
    const reason = cause?.code ?? cause?.message ?? response.message;
    return { why: `couldn't download it from GitHub (${reason})` };
  }
  if (response.status === 404)
    return { why: `CI hasn't published one for src-tauri ${tree.slice(0, 7)}` };
  if (!response.ok) return { why: `GitHub answered ${response.status} for it` };
  return response;
}

// A clone from before the repository was renamed has its old name, which GitHub
// redirects; CI signs with the current one. The old one when GitHub can't say.
async function currentName(repo: string, get: typeof fetch) {
  const signal = AbortSignal.timeout(10_000);
  const response = await get(`https://api.github.com/repos/${repo}`, {
    signal,
  }).catch(() => null);
  if (!response?.ok) return repo;
  const { full_name } = await response.json().catch(() => ({}));
  return typeof full_name === "string" ? full_name : repo;
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
  const tree = await treeOf(dir, "HEAD");
  const repo = await currentName(from.repo, get);
  const got = await fetchRelease(releaseUrl(repo, tree, from.asset), tree, get);
  if ("why" in got) return got;
  return keepVerified(got, join(into, from.asset), repo, verify);
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
