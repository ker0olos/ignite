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
    expect(await appUpdate({ root: app, install })).toEqual({ updated: false });
    expect(install).not.toHaveBeenCalled();
  });

  it("pulls new commits, installing only when the lockfile changed", async () => {
    const install = vi.fn(async () => {});
    await commit(origin, "README.md", "hello\n", "Second");
    expect(await appUpdate({ root: app, install })).toEqual({ updated: true });
    expect((await appVersion(app)).subject).toBe("Second");
    expect(install).not.toHaveBeenCalled();

    await commit(origin, "pnpm-lock.yaml", "{}\n", "Bump deps");
    expect(await appUpdate({ root: app, install })).toEqual({ updated: true });
    expect(install).toHaveBeenCalledWith(app);
  });

  it("fails with git's reason instead of merging over local commits", async () => {
    await commit(origin, "README.md", "theirs\n", "Upstream");
    await commit(app, "notes.md", "mine\n", "Local");
    await expect(appUpdate({ root: app })).rejects.toThrow(/fast-forward/i);
    expect((await appVersion(app)).subject).toBe("Local");
  });
});

describe("appUpdate in a launcher version", () => {
  it("builds the latest beside it and says it's ready", async () => {
    const stage = vi.fn(async () => "b".repeat(40));
    const root = join(dir, "apps", "a".repeat(40));
    const result = await appUpdate({
      root,
      install: vi.fn(),
      stage,
      apps: join(dir, "apps"),
    });
    expect(stage).toHaveBeenCalledWith(
      root,
      expect.any(String),
      expect.any(Function),
      expect.any(Function),
    );
    expect(result).toEqual({ updated: false, ready: true });
  });

  it("isn't ready when the staged version is the running one", async () => {
    const sha = "a".repeat(40);
    const stage = vi.fn(async () => sha);
    const root = join(dir, "apps", sha);
    expect(
      await appUpdate({
        root,
        install: vi.fn(),
        stage,
        apps: join(dir, "apps"),
      }),
    ).toEqual({
      updated: false,
      ready: false,
    });
  });
});

describe("appUpdate's found commit", () => {
  it("names the update it installs and readies, from the clone's commits", async () => {
    const root = join(dir, "apps", "a".repeat(40));
    git(dir, "clone", "-q", origin, root);
    await commit(origin, "README.md", "hello\n", "Second");
    git(root, "fetch", "-q");
    const latest = git(root, "rev-parse", "origin/main");
    const installing = vi.fn();
    const stage = vi.fn(async (...args: unknown[]) => {
      (args[3] as (sha: string) => void)(latest);
      return latest;
    });
    const result = await appUpdate({
      root,
      stage,
      installing,
      apps: join(dir, "apps"),
    });
    expect(result.next).toMatchObject({ sha: latest, subject: "Second" });
    await vi.waitFor(() =>
      expect(installing).toHaveBeenCalledWith(
        expect.objectContaining({ sha: latest }),
      ),
    );
  });
});

describe("appUpdate's warning", () => {
  it("passes on why the staged update's binary wasn't verified", async () => {
    const stage = vi.fn(async (_root, _mods, warn?: (t: string) => void) => {
      warn?.("Using CI's binary unverified: offline.");
      return "b".repeat(40);
    });
    const root = join(dir, "apps", "a".repeat(40));
    expect(
      await appUpdate({
        root,
        install: vi.fn(),
        stage,
        apps: join(dir, "apps"),
      }),
    ).toEqual({
      updated: false,
      ready: true,
      warning: "Using CI's binary unverified: offline.",
    });
  });
});
