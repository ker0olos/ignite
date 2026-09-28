// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRoot, appUpdate, appVersion } from "./appUpdate.ts";

let dir: string;
let origin: string;
let app: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

async function commit(
  cwd: string,
  file: string,
  text: string,
  message: string,
) {
  await writeFile(join(cwd, file), text);
  git(cwd, "add", file);
  git(cwd, "commit", "-q", "-m", message);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-update-"));
  origin = join(dir, "origin");
  app = join(dir, "app");
  vi.stubEnv("GIT_AUTHOR_NAME", "Test");
  vi.stubEnv("GIT_AUTHOR_EMAIL", "test@example.com");
  vi.stubEnv("GIT_COMMITTER_NAME", "Test");
  vi.stubEnv("GIT_COMMITTER_EMAIL", "test@example.com");
  git(dir, "init", "-q", "-b", "main", origin);
  await commit(origin, "README.md", "hi\n", "First");
  git(dir, "clone", "-q", origin, app);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("appRoot", () => {
  it("is the folder above the sidecar's", () => {
    const argv = process.argv;
    process.argv = ["node", "/repo/sidecar/main.ts"];
    try {
      expect(appRoot()).toBe("/repo");
    } finally {
      process.argv = argv;
    }
  });
});

describe("appVersion", () => {
  it("reads the checked-out commit", async () => {
    const version = await appVersion(app);
    expect(version.sha).toBe(git(app, "rev-parse", "HEAD"));
    expect(version.subject).toBe("First");
    expect(Number.isNaN(Date.parse(version.date))).toBe(false);
  });
});

describe("appUpdate", () => {
  it("says so when it's already up to date", async () => {
    const install = vi.fn(async () => {});
    expect(await appUpdate(app, install)).toEqual({ updated: false });
    expect(install).not.toHaveBeenCalled();
  });

  it("pulls new commits, installing only when the lockfile changed", async () => {
    const install = vi.fn(async () => {});
    await commit(origin, "README.md", "hello\n", "Second");
    expect(await appUpdate(app, install)).toEqual({ updated: true });
    expect((await appVersion(app)).subject).toBe("Second");
    expect(install).not.toHaveBeenCalled();

    await commit(origin, "package-lock.json", "{}\n", "Bump deps");
    expect(await appUpdate(app, install)).toEqual({ updated: true });
    expect(install).toHaveBeenCalledWith(app);
  });

  it("fails with git's reason instead of merging over local commits", async () => {
    await commit(origin, "README.md", "theirs\n", "Upstream");
    await commit(app, "notes.md", "mine\n", "Local");
    await expect(appUpdate(app)).rejects.toThrow(/fast-forward/i);
    expect((await appVersion(app)).subject).toBe("Local");
  });
});
