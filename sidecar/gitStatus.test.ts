// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { fileDiff } from "./gitReview.ts";
import { gitStatus, repoDetails, touchedDirs } from "./gitStatus.ts";

let root: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

const calls = (...c: [string, Record<string, unknown>][]): AgentMessage[] => [
  {
    role: "assistant",
    content: c.map(([name, args], i) => ({
      type: "toolCall" as const,
      id: `c${i}`,
      name,
      arguments: args,
    })),
  } as AgentMessage,
];

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "git-status-")));
  vi.stubEnv("GIT_AUTHOR_NAME", "Me");
  vi.stubEnv("GIT_AUTHOR_EMAIL", "me@example.com");
  vi.stubEnv("GIT_COMMITTER_NAME", "Me");
  vi.stubEnv("GIT_COMMITTER_EMAIL", "me@example.com");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("touchedDirs", () => {
  it("lists the workdir, git calls' -C folders and edited files' folders", () => {
    const messages = calls(
      ["git", { args: ["-C", "api", "status"] }],
      ["edit", { path: "web/src/app.ts" }],
      ["write", { path: "/elsewhere/notes.md" }],
      ["read", { path: "ignored/file.ts" }],
    );
    expect(touchedDirs(messages, "/w")).toEqual([
      "/w",
      "/w/api",
      "/w/web/src",
      "/elsewhere",
    ]);
  });
});

describe("gitStatus", () => {
  it("reports each touched repository's branch, uncommitted files and unpushed commits", async () => {
    git(root, "init", "-q", "--bare", "-b", "main", "remote.git");
    git(root, "clone", "-q", "remote.git", "app");
    const app = join(root, "app");
    await writeFile(join(app, "a.txt"), "one\n");
    git(app, "add", ".");
    git(app, "commit", "-qm", "first");
    git(app, "push", "-q", "origin", "HEAD:main");
    git(app, "switch", "-q", "-c", "feat");
    git(app, "commit", "-q", "--allow-empty", "-m", "local");
    await writeFile(join(app, "a.txt"), "two\n");
    await writeFile(join(app, "b.txt"), "new\n");

    const local = join(root, "local");
    await mkdir(local);
    git(local, "init", "-q", "-b", "main");
    git(local, "commit", "-q", "--allow-empty", "-m", "only here");

    const messages = calls(["edit", { path: join(local, "x.ts") }]);
    const found = await gitStatus(messages, app);
    // No GitHub remote, so gh finds no pull request.
    expect(found).toEqual([
      { repo: app, name: "app", branch: "feat", changed: 2, unpushed: 1 },
      { repo: local, name: "local", branch: "main", changed: 0, unpushed: 0 },
    ]);
  });

  it("skips folders outside git", async () => {
    expect(await gitStatus([], root)).toEqual([]);
  });
});

describe("repoDetails", () => {
  it("lists tracked and new files as uncommitted, and the commits no remote has", async () => {
    git(root, "init", "-q", "--bare", "-b", "main", "remote.git");
    git(root, "clone", "-q", "remote.git", "app");
    const app = join(root, "app");
    await writeFile(join(app, "a.txt"), "one\n");
    git(app, "add", ".");
    git(app, "commit", "-qm", "first");
    git(app, "push", "-q", "origin", "HEAD:main");
    git(app, "commit", "-q", "--allow-empty", "-m", "local");
    await writeFile(join(app, "a.txt"), "two\n");
    await writeFile(join(app, "new.txt"), "x\ny\n");

    expect(await repoDetails(app)).toEqual({
      files: [
        { path: "a.txt", status: "M", added: 1, removed: 1 },
        { path: "new.txt", status: "A", added: 2, removed: 0 },
      ],
      commits: [{ hash: expect.any(String), subject: "local" }],
    });
    expect(await fileDiff(app, "HEAD", "new.txt")).toContain("+y");
    await writeFile(join(app, ".gitignore"), "secret\n");
    await writeFile(join(app, "secret"), "token\n");
    // Only untracked files the repository would list get a whole-file diff.
    expect(await fileDiff(app, "HEAD", "secret")).toBe("");
    await expect(fileDiff(app, "HEAD", "../remote.git/HEAD")).rejects.toThrow();
  });
});

describe("untracked files", () => {
  it("counts each file in a new folder, reads odd names, and leaves out large ones", async () => {
    const app = join(root, "app");
    await mkdir(join(app, "new"), { recursive: true });
    git(app, "init", "-q", "-b", "main");
    git(app, "commit", "-q", "--allow-empty", "-m", "first");
    await writeFile(join(app, "new", "a.txt"), "a\n");
    await writeFile(join(app, "new", "empty.txt"), "");
    await writeFile(join(app, "café.txt"), "x\ny");
    await writeFile(join(app, "big.log"), "x".repeat(1_000_001));

    const [status] = await gitStatus([], app);
    expect(status.changed).toBe(4);
    expect((await repoDetails(app)).files).toEqual([
      { path: "big.log", status: "A", added: null, removed: 0 },
      { path: "café.txt", status: "A", added: 2, removed: 0 },
      { path: "new/a.txt", status: "A", added: 1, removed: 0 },
      { path: "new/empty.txt", status: "A", added: 0, removed: 0 },
    ]);
    expect(await fileDiff(app, "HEAD", "café.txt")).toContain("+y");
    await expect(fileDiff(app, "HEAD", "big.log")).rejects.toThrow("too large");
  });
});
