/**
 * The app's binary from the GitHub release CI made for its src-tauri/ tree
 * (.github/workflows/binary.yml), used only once `gh attestation verify`
 * proves that workflow built it from main.
 */
import { execFile } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { git, remoteName } from "./worktreeGit.ts";

const exec = promisify(execFile);
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

/** Why `gh` can't verify attestations here, or null when it can. */
async function ghReady(): Promise<string | null> {
  try {
    await exec("gh", ["auth", "status"], { timeout: 20_000 });
    return null;
  } catch (error) {
    return (error as { code?: string }).code === "ENOENT"
      ? "the GitHub CLI (gh) isn't installed"
      : "the GitHub CLI isn't signed in (gh auth login)";
  }
}

async function ghVerify(file: string, repo: string) {
  await exec(
    "gh",
    [
      "attestation",
      "verify",
      file,
      ...["--repo", repo],
      ...["--signer-workflow", `${repo}/${WORKFLOW}`],
      ...["--source-ref", "refs/heads/main"],
    ],
    { timeout: 120_000 },
  );
}

const originRepo = (repoDir: string) =>
  git(repoDir, ["remote", "get-url", "origin"])
    .then(githubRepo)
    .catch(() => null);

const treeOf = (repoDir: string, rev: string) =>
  git(repoDir, ["rev-parse", `${rev}:src-tauri`]);

const releaseUrl = (repo: string, tree: string, asset: string) =>
  `https://github.com/${repo}/releases/download/bin-${tree}/${asset}`;

/** A downloaded, verified binary, or why there's none and it must be built. */
type Download = { file: string } | { why: string };

// The repository to download from, or why there's nothing to download.
async function source(
  dir: string,
  asset: string | null,
  ready: typeof ghReady,
): Promise<{ why: string } | { repo: string; asset: string }> {
  if (!asset) return { why: "CI builds no binary for this machine" };
  const repo = await originRepo(dir);
  if (!repo) return { why: "this clone's origin isn't on GitHub" };
  const unready = await ready();
  return unready ? { why: unready } : { repo, asset };
}

// Keeps the downloaded file only if its attestation verifies.
async function keepVerified(
  response: Response,
  file: string,
  repo: string,
  verify: typeof ghVerify,
): Promise<Download> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  await chmod(file, 0o755);
  try {
    await verify(file, repo);
    return { file };
  } catch (error) {
    await rm(file, { force: true });
    const { stderr } = error as { stderr?: string };
    return { why: `its attestation didn't verify: ${stderr?.trim() || error}` };
  }
}

/** Downloads and verifies the binary for checkout `dir`'s src-tauri/ into `into`. */
export async function downloadBinary(
  dir: string,
  into: string,
  { get = fetch as typeof fetch, ready = ghReady, verify = ghVerify } = {},
  asset: string | null = here,
): Promise<Download> {
  const from = await source(dir, asset, ready);
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
