// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createVerifier } from "sigstore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAttestation } from "./attestation.ts";

let dir: string;
let file: string;
const WORKFLOW = ".github/workflows/binary.yml";
const digest = createHash("sha256").update("binary").digest("hex");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "attestation-"));
  file = join(dir, "bin");
  await writeFile(file, "binary");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const bundle = (sha256: string) => ({
  dsseEnvelope: {
    payload: Buffer.from(
      JSON.stringify({ subject: [{ name: "bin", digest: { sha256 } }] }),
    ).toString("base64"),
  },
});
const api = (status: number, attestations: unknown[] = []) =>
  vi.fn(
    async () => new Response(JSON.stringify({ attestations }), { status }),
  ) as unknown as typeof fetch;

// A verifier whose check passes, or throws `error`.
const verifier = (error?: Error) => {
  const verify = vi.fn(() => {
    if (error) throw error;
    return {};
  });
  const create = vi.fn(async () => ({ verify }));
  return { create: create as unknown as typeof createVerifier, verify };
};
const tufError = (message: string) =>
  Object.assign(new Error(message), { name: "TUFError" });

describe("verifyAttestation", () => {
  it("asks GitHub for the file's digest and checks the signer is the workflow on main", async () => {
    const get = api(200, [{ bundle: bundle(digest) }]);
    const { create, verify } = verifier();
    expect(
      await verifyAttestation(file, "me/app", WORKFLOW, get, create),
    ).toBeNull();
    expect(get).toHaveBeenCalledWith(
      `https://api.github.com/repos/me/app/attestations/sha256:${digest}`,
      expect.anything(),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        certificateIssuer: "https://token.actions.githubusercontent.com",
        certificateIdentityURI: `https://github.com/me/app/${WORKFLOW}@refs/heads/main`,
      }),
    );
    expect(verify).toHaveBeenCalledWith(bundle(digest));
  });

  it("fails when GitHub has no attestation for it", async () => {
    await expect(
      verifyAttestation(file, "me/app", WORKFLOW, api(404), verifier().create),
    ).rejects.toThrow("GitHub has no attestation for it");
  });

  it("ignores attestations for other files", async () => {
    const { create } = verifier();
    await expect(
      verifyAttestation(
        file,
        "me/app",
        WORKFLOW,
        api(200, [{ bundle: bundle("0".repeat(64)) }, { bundle: {} }]),
        create,
      ),
    ).rejects.toThrow("no attestation from the workflow on main covers it");
    expect(create).not.toHaveBeenCalled();
  });

  it("fails on any error from the check itself: signature, signer or a malformed bundle", async () => {
    for (const error of [
      new Error("certificate identity error"),
      Object.assign(new Error("bundle is invalid"), {
        name: "ValidationError",
      }),
    ]) {
      await expect(
        verifyAttestation(
          file,
          "me/app",
          WORKFLOW,
          api(200, [{ bundle: bundle(digest) }]),
          verifier(error).create,
        ),
      ).rejects.toThrow(`its signature didn't verify: ${error.message}`);
    }
  });

  it("says why it couldn't check, when GitHub or Sigstore can't be reached", async () => {
    const offline = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;
    expect(
      await verifyAttestation(file, "me/app", WORKFLOW, offline, vi.fn()),
    ).toBe("GitHub couldn't be reached (ENOTFOUND)");
    expect(
      await verifyAttestation(file, "me/app", WORKFLOW, api(403), vi.fn()),
    ).toBe("GitHub's attestation API answered 403");
    const noTuf = vi.fn(async () => {
      throw tufError("tuf-repo-cdn.sigstore.dev unreachable");
    }) as unknown as typeof createVerifier;
    expect(
      await verifyAttestation(
        file,
        "me/app",
        WORKFLOW,
        api(200, [{ bundle: bundle(digest) }]),
        noTuf,
      ),
    ).toBe(
      "Sigstore couldn't be reached (tuf-repo-cdn.sigstore.dev unreachable)",
    );
  });

  it("fails when setting up the check fails for another reason", async () => {
    const broken = vi.fn(async () => {
      throw new Error("bad options");
    }) as unknown as typeof createVerifier;
    await expect(
      verifyAttestation(
        file,
        "me/app",
        WORKFLOW,
        api(200, [{ bundle: bundle(digest) }]),
        broken,
      ),
    ).rejects.toThrow("bad options");
  });
});
