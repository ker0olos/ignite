/**
 * Checks a file's GitHub build attestation as `gh attestation verify` does,
 * without gh: fetched from GitHub's API (public repositories need no login),
 * its Sigstore signature checked against the public-good trust root.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Bundle, createVerifier } from "sigstore";
import { APP_NAME } from "../src/lib/app.ts";

const ISSUER = "https://token.actions.githubusercontent.com";
const TUF_CACHE = join(homedir(), `.${APP_NAME}`, "sigstore");

// The sha256 digests the attestation's statement covers.
function subjects(bundle: Bundle): string[] {
  try {
    const payload = (bundle as { dsseEnvelope?: { payload: string } })
      .dsseEnvelope!.payload;
    const statement = JSON.parse(Buffer.from(payload, "base64").toString());
    return (statement.subject ?? []).map(
      (s: { digest?: { sha256?: string } }) => s.digest?.sha256,
    );
  } catch {
    return [];
  }
}

// Only Sigstore's trust data being unreachable means the check couldn't run;
// any other error (a bad signature, signer or bundle) fails it.
const unreachable = (error: unknown) =>
  error instanceof Error && error.name === "TUFError";

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type Found = { bundles: Bundle[] } | { unchecked: string };

// GitHub's attestations for a digest; a missing one throws, an unreachable API only says so.
async function attestationsFor(
  repo: string,
  digest: string,
  get: typeof fetch,
): Promise<Found> {
  const response = await get(
    `https://api.github.com/repos/${repo}/attestations/sha256:${digest}`,
    {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(60_000),
    },
  ).catch((error: Error) => error);
  if (response instanceof Error)
    return { unchecked: `GitHub couldn't be reached (${response.message})` };
  if (response.status === 404)
    throw new Error("GitHub has no attestation for it");
  if (!response.ok)
    return {
      unchecked: `GitHub's attestation API answered ${response.status}`,
    };
  const { attestations = [] } = (await response.json()) as {
    attestations?: { bundle: Bundle }[];
  };
  return {
    bundles: attestations
      .map((a) => a.bundle)
      .filter((b) => subjects(b).includes(digest)),
  };
}

/**
 * Checks that `file` has an attestation signed by `repo`'s `workflow` running
 * on main: null once it does, or why it couldn't be checked (GitHub or
 * Sigstore unreachable). Throws when the check ran and failed.
 */
export async function verifyAttestation(
  file: string,
  repo: string,
  workflow: string,
  get: typeof fetch = fetch,
  verifier: typeof createVerifier = createVerifier,
): Promise<string | null> {
  const digest = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  const found = await attestationsFor(repo, digest, get);
  if ("unchecked" in found) return found.unchecked;
  if (!found.bundles.length)
    throw new Error("no attestation from the workflow on main covers it");
  const check = await verifier({
    certificateIssuer: ISSUER,
    certificateIdentityURI: `https://github.com/${repo}/${workflow}@refs/heads/main`,
    tufCachePath: TUF_CACHE,
  }).catch((error: unknown) => {
    if (unreachable(error)) return message(error);
    throw error;
  });
  if (typeof check === "string")
    return `Sigstore couldn't be reached (${check})`;
  let failed: unknown = null;
  for (const bundle of found.bundles) {
    try {
      check.verify(bundle);
      return null;
    } catch (error) {
      failed = error;
    }
  }
  throw new Error(`its signature didn't verify: ${message(failed)}`);
}
