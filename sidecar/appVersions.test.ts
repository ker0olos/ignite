// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let clone: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

// The state paths come from the home folder when the modules load.
async function load() {
  vi.resetModules();
  return {
    ...(await import("./appVersions.ts")),
    ...(await import("./appBuild.ts")),
  };
}

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "app-versions-")));
  vi.stubEnv("HOME", join(dir, "home"));
  vi.stubEnv("USERPROFILE", join(dir, "home"));
  for (const v of ["AUTHOR", "COMMITTER"]) {
    vi.stubEnv(`GIT_${v}_NAME`, "Test");
    vi.stubEnv(`GIT_${v}_EMAIL`, "test@example.com");
  }
  const origin = join(dir, "origin");
  git(dir, "init", "-q", "-b", "main", origin);
  await writeFile(join(origin, "README.md"), "hi\n");
  git(origin, "add", ".");
  git(origin, "commit", "-q", "-m", "First");
  clone = join(dir, "clone");
  git(dir, "clone", "-q", origin, clone);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("launcher state", () => {
  it("reads what was written, and nothing once cleared", async () => {
    const { readState, writeState, clearState } = await load();
    expect(await readState("good")).toBe("");
    await writeState("good", "abc\n");
    expect(await readState("good")).toBe("abc");
    await clearState("good");
    expect(await readState("good")).toBe("");
  });
});

describe("cloneOf", () => {
  it("is the clone, from the clone or one of its worktrees", async () => {
    const { cloneOf } = await load();
    expect(await cloneOf(clone)).toBe(clone);
    const tree = join(dir, "tree");
    git(clone, "worktree", "add", "-q", "--detach", tree);
    expect(await cloneOf(tree)).toBe(clone);
  });
});

describe("stageUpdate", () => {
  it("builds nothing when the running version is the latest", async () => {
    const { stageUpdate, readState } = await load();
    expect(await stageUpdate(clone, "")).toBeNull();
    expect(await readState("next")).toBe("");
  });

  it("skips a latest version that already failed to start", async () => {
    const { stageUpdate, writeState } = await load();
    const origin = join(dir, "origin");
    await writeFile(join(origin, "README.md"), "two\n");
    git(origin, "commit", "-qam", "Second");
    await writeState("bad", git(origin, "rev-parse", "HEAD"));
    expect(await stageUpdate(clone, "")).toBeNull();
  });
});

describe("pruneVersions", () => {
  it("removes unfinished versions once no process builds them", async () => {
    const { pruneVersions, versionDir, APPS } = await load();
    const unfinished = versionDir("b".repeat(40));
    await mkdir(unfinished, { recursive: true });
    await writeFile(join(APPS, "build.lock"), String(process.pid));
    await pruneVersions(clone, []);
    expect(existsSync(unfinished)).toBe(true);
    await rm(join(APPS, "build.lock"));
    await pruneVersions(clone, []);
    expect(existsSync(unfinished)).toBe(false);
  });

  it("removes built versions not kept, and leaves unfinished ones being built", async () => {
    const { pruneVersions, versionDir, APPS } = await load();
    const head = git(clone, "rev-parse", "HEAD");
    const kept = versionDir("a".repeat(40));
    const old = versionDir(head);
    const unfinished = versionDir("b".repeat(40));
    git(clone, "worktree", "add", "-q", "--detach", old, head);
    for (const v of [kept, old]) {
      await mkdir(join(v, "build"), { recursive: true });
      await writeFile(join(v, "build", "ok"), "");
    }
    await mkdir(unfinished, { recursive: true });
    await writeFile(join(APPS, "build.lock"), String(process.pid));
    await pruneVersions(clone, ["a".repeat(40)]);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(unfinished)).toBe(true);
    expect(git(clone, "worktree", "list")).not.toContain(old);
  });
});
