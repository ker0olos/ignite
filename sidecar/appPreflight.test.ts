// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lockHash } from "./appPackages.ts";
import {
  followRename,
  preflight,
  readyToRun,
  renamedUrl,
} from "./appPreflight.ts";

let dir: string;
let clone: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: clone, encoding: "utf8" }).trim();
const answer = (body: unknown, ok = true) =>
  vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-preflight-"));
  clone = join(dir, "clone");
  await mkdir(clone);
  for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml"])
    await writeFile(join(clone, file), file);
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "c");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("renamedUrl", () => {
  it("swaps the owner/name, keeping SSH or HTTPS and .git", () => {
    expect(renamedUrl("git@github.com:me/ignition.git", "me/ignite")).toBe(
      "git@github.com:me/ignite.git",
    );
    expect(renamedUrl("https://github.com/me/ignition", "me/ignite")).toBe(
      "https://github.com/me/ignite",
    );
  });
});

describe("followRename", () => {
  it("points the origin at the repository's new name", async () => {
    git("remote", "add", "origin", "git@github.com:me/ignition.git");
    const get = answer({ full_name: "me/ignite" });
    expect(await followRename(clone, get)).toBe(
      "The repository is now me/ignite; this clone's origin follows it.",
    );
    expect(get).toHaveBeenCalledWith(
      "https://api.github.com/repos/me/ignition",
      expect.anything(),
    );
    expect(git("remote", "get-url", "origin")).toBe(
      "git@github.com:me/ignite.git",
    );
  });

  it("leaves the origin when unrenamed, offline, or not on GitHub", async () => {
    git("remote", "add", "origin", "https://github.com/me/ignite.git");
    expect(
      await followRename(clone, answer({ full_name: "Me/Ignite" })),
    ).toBeNull();
    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await followRename(clone, offline)).toBeNull();
    git("remote", "set-url", "origin", "https://gitlab.com/me/ignite.git");
    expect(await followRename(clone, answer({}))).toBeNull();
    expect(git("remote", "get-url", "origin")).toBe(
      "https://gitlab.com/me/ignite.git",
    );
  });
});

describe("preflight", () => {
  const plenty = () => 5 * 1024 ** 3;

  it("passes with room and both hosts in reach", async () => {
    expect(await preflight(dir, { get: answer({}), free: plenty })).toBeNull();
  });

  it("says how much room there is when under 1 GB", async () => {
    const tight = () => 0.4 * 1024 ** 3;
    expect(await preflight(dir, { get: answer({}), free: tight })).toBe(
      "It needs about 1 GB free on the disk with your home folder, and has 0.4 GB.",
    );
  });

  it("names the host it can't reach and why", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes("github")) {
        throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
      }
      return { ok: true };
    }) as unknown as typeof fetch;
    expect(await preflight(dir, { get, free: plenty })).toBe(
      "It can't reach github.com (ENOTFOUND); check your connection.",
    );
  });
});

describe("readyToRun", () => {
  it("only once this lockfile's packages and this commit's version are in", async () => {
    const home = join(dir, "home");
    expect(await readyToRun(clone, home)).toBe(false);
    const ignite = join(home, ".ignite");
    await mkdir(join(ignite, "packages", await lockHash(clone)), {
      recursive: true,
    });
    await writeFile(join(ignite, "packages", await lockHash(clone), "ok"), "");
    expect(await readyToRun(clone, home)).toBe(false);
    const build = join(ignite, "app", git("rev-parse", "HEAD"), "build");
    await mkdir(build, { recursive: true });
    await writeFile(join(build, "ok"), "");
    expect(await readyToRun(clone, home)).toBe(true);
  });
});
