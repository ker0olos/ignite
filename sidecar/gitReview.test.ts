// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  committed,
  fileDiff,
  pushTargets,
  readCommit,
  review,
} from "./gitReview.ts";

let root: string;
let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" });

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "git-review-")));
  vi.stubEnv("GIT_AUTHOR_NAME", "Me");
  vi.stubEnv("GIT_AUTHOR_EMAIL", "me@example.com");
  vi.stubEnv("GIT_COMMITTER_NAME", "Me");
  vi.stubEnv("GIT_COMMITTER_EMAIL", "me@example.com");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", "remote.git"], {
    cwd: root,
  });
  execFileSync("git", ["clone", "-q", "remote.git", "app"], { cwd: root });
  repo = join(root, "app");
  await writeFile(join(repo, "a.txt"), "one\ntwo\n");
  git("add", ".");
  git("commit", "-qm", "first");
  git("push", "-q", "origin", "HEAD:main");
  git("branch", "-q", "--set-upstream-to=origin/main");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("readCommit", () => {
  it.each([
    [["-m", "fix"], { message: "fix", all: false, paths: [] }],
    [["-am", "fix"], { message: "fix", all: true, paths: [] }],
    [["-m", "a", "-m", "b"], { message: "a\n\nb", all: false, paths: [] }],
    [["--message=x", "--all"], { message: "x", all: true, paths: [] }],
    [["-mx", "src"], { message: "x", all: false, paths: ["src"] }],
    [
      ["--author", "A <a@b>", "--", "b.ts"],
      { message: undefined, all: false, paths: ["b.ts"] },
    ],
  ])("reads %j", (rest, expected) => {
    expect(readCommit(rest)).toEqual(expected);
  });
});

describe("review", () => {
  it("shows a commit's staged files with line counts and its message", async () => {
    await writeFile(join(repo, "a.txt"), "one\n2\n3\n");
    await writeFile(join(repo, "b.txt"), "new\n");
    git("add", "b.txt");
    expect(await review("commit", ["commit", "-m", "add b"], repo)).toEqual({
      kind: "commit",
      repo,
      range: "staged",
      place: { name: "app", branch: "main" },
      files: [{ path: "b.txt", status: "A", added: 1, removed: 0 }],
      message: "add b",
    });
    const all = await review("commit", ["commit", "-am", "all"], repo);
    expect(all.range).toBe("HEAD");
    // -a commits what's staged too.
    expect(all.files).toEqual([
      { path: "a.txt", status: "M", added: 2, removed: 1 },
      { path: "b.txt", status: "A", added: 1, removed: 0 },
    ]);
  });

  it("finds the repository -C names", async () => {
    const shown = await review("commit", ["-C", "app", "commit"], root);
    expect(shown.repo).toBe(repo);
  });

  it("names the repository by its origin, and no branch when detached", async () => {
    git("remote", "set-url", "origin", "git@github.com:me/app.git");
    git("switch", "-q", "--detach");
    const shown = await review("commit", ["commit"], repo);
    expect(shown.place).toEqual({ name: "me/app" });
  });

  it("shows the commits a push sends and what they change", async () => {
    await writeFile(join(repo, "a.txt"), "one\n");
    git("commit", "-qam", "shorter");
    const shown = await review("push", ["push"], repo);
    expect(shown.commits).toEqual([
      { hash: expect.stringMatching(/^[0-9a-f]+$/), subject: "shorter" },
    ]);
    expect(shown.files).toEqual([
      { path: "a.txt", status: "M", added: 0, removed: 1 },
    ]);
    expect(await fileDiff(repo, shown.range, "a.txt")).toContain("-two");
  });

  const subjects = async (args: string[]) =>
    (await review("push", args, repo)).commits?.map((c) => c.subject);

  it("compares with the branch a push names, without an upstream", async () => {
    git("branch", "-q", "--unset-upstream");
    git("commit", "-q", "--allow-empty", "-m", "fix");
    expect(await subjects(["push", "origin", "main"])).toEqual(["fix"]);
    expect(await subjects(["push", "origin", "HEAD:refs/heads/main"])).toEqual([
      "fix",
    ]);
  });

  it("shows a new branch's commits the remote doesn't have", async () => {
    git("switch", "-q", "-c", "feat");
    git("commit", "-q", "--allow-empty", "-m", "one");
    git("commit", "-q", "--allow-empty", "-m", "two");
    expect(await subjects(["push", "-u", "origin", "feat"])).toEqual([
      "two",
      "one",
    ]);
  });

  it("shows no commits when everything is pushed", async () => {
    git("branch", "-q", "--unset-upstream");
    expect(await subjects(["push"])).toEqual([]);
  });
});

describe("pushTargets", () => {
  it.each([
    [[], "main", ["refs/remotes/origin/main", "@{upstream}"]],
    [["origin", "HEAD"], "feat", ["refs/remotes/origin/feat", "@{upstream}"]],
    [["up", "a:refs/heads/b"], "x", ["refs/remotes/up/b", "@{upstream}"]],
    [
      ["-u", "origin", "+feat"],
      "x",
      ["refs/remotes/origin/feat", "@{upstream}"],
    ],
    [["https://h/r.git", "feat"], "x", ["@{upstream}"]],
    [[], null, ["@{upstream}"]],
  ])("%j on %s → %j", (rest, current, refs) => {
    expect(pushTargets(rest, current)).toEqual(refs);
  });
});

describe("committed", () => {
  it("points a commit's review at the new commit", async () => {
    await writeFile(join(repo, "a.txt"), "changed\n");
    const before = await review("commit", ["commit", "-am", "x"], repo);
    git("commit", "-qam", "x");
    const after = await committed(before);
    expect(after.range).toMatch(/^[0-9a-f]{40}\^!$/);
    expect(await fileDiff(repo, after.range, "a.txt")).toContain("+changed");
  });
});

describe("fileDiff", () => {
  it("refuses a range that isn't one", async () => {
    await expect(fileDiff(repo, "--output=/tmp/x", "a.txt")).rejects.toThrow(
      "Not a diff range",
    );
  });

  it("fails for a folder that isn't a repository", async () => {
    await expect(fileDiff(root, "HEAD", "a.txt")).rejects.toThrow(
      "Couldn't diff a.txt.",
    );
  });
});
