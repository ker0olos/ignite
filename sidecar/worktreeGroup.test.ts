// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaces } from "./worktrees.ts";
import {
  folderOf,
  gitAccess,
  groupCheckouts,
  stateRef,
  worktreePath,
} from "./worktreeGit.ts";
import { ghDir, groupRepos } from "./worktreeGroup.ts";

let base: string;
let folder: string;
let root: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const read = (...path: string[]) => readFileSync(join(...path), "utf8");
const write = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};
const repoIn = (name: string) => {
  const repo = join(folder, name);
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  write(join(repo, "app.ts"), `${name}\n`);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  return repo;
};

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "worktree-group-")));
  folder = join(base, "projects");
  root = join(base, "worktrees");
  mkdirSync(folder);
  repoIn("server");
  repoIn("web");
  mkdirSync(join(folder, "empty"));
  git(join(folder, "empty"), "init", "-q");
  write(join(folder, "CLAUDE.md"), "notes\n");
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("groupRepos", () => {
  it("finds the repositories directly in a folder, not ones without a commit", async () => {
    expect((await groupRepos(folder)).sort()).toEqual([
      join(folder, "server"),
      join(folder, "web"),
    ]);
    expect(await groupRepos(join(base, "missing"))).toEqual([]);
  });
});

describe("a folder of repositories", () => {
  it("gets its own copy: each repository a detached worktree, its other files copied", async () => {
    const ws = await createWorkspaces(root).open(folder, "a");
    await ws.ready;
    expect(ws.dir).toBe(worktreePath(folder, "a", root));
    expect(read(ws.dir, "server", "app.ts")).toBe("server\n");
    expect(read(ws.dir, "web", "app.ts")).toBe("web\n");
    expect(read(ws.dir, "CLAUDE.md")).toBe("notes\n");
    expect(existsSync(join(ws.dir, "empty"))).toBe(false);
    expect(git(join(ws.dir, "web"), "branch", "--show-current")).toBe("");
    expect(
      git(join(folder, "web"), "worktree", "list").split("\n"),
    ).toHaveLength(2);
  });

  it("maps its files back to the user's folder, and lets git in each worktree write its own files", async () => {
    const ws = await createWorkspaces(root).open(folder, "a");
    expect(folderOf(ws.dir, root)).toBe(folder);
    expect(folderOf(join(ws.dir, "web", "app.ts"), root)).toBe(
      join(folder, "web", "app.ts"),
    );
    const access = gitAccess(ws.dir, root);
    expect(access.allow).toContain(join(folder, "web", ".git", "objects"));
    expect(access.allow).toContain(join(folder, "server", ".git", "objects"));
    expect(access.deny).toContain(join(ws.dir, "web", ".git"));
  });

  it("keeps each repository's work when it's closed, and brings it back", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    write(join(ws.dir, "web", "app.ts"), "agent\n");
    git(join(ws.dir, "server"), "switch", "-q", "-c", "feat/x");
    await workspaces.close(folder, "a");
    expect(existsSync(ws.dir)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
    expect(git(join(folder, "web"), "rev-parse", stateRef("a"))).toBeTruthy();
    const again = await workspaces.open(folder, "a");
    expect(read(again.dir, "web", "app.ts")).toBe("agent\n");
    expect(git(join(again.dir, "server"), "branch", "--show-current")).toBe(
      "feat/x",
    );
  });

  it("starts a fork as a copy of each repository's files", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    write(join(ws.dir, "server", "made.ts"), "made\n");
    await workspaces.fork(folder, "a", "b");
    const fork = await workspaces.open(folder, "b");
    expect(read(fork.dir, "server", "made.ts")).toBe("made\n");
  });

  it("sweeps a copy whose app is gone, keeping its work, and leaves a live one", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    await workspaces.open(folder, "live");
    write(join(ws.dir, "web", "app.ts"), "agent\n");
    for (const name of ["server", "web"]) {
      const checkout = join(ws.dir, name);
      git(join(folder, name), "worktree", "unlock", checkout);
      git(
        join(folder, name),
        "worktree",
        "lock",
        "--reason",
        "ignite pid 999999",
        checkout,
      );
    }
    utimesSync(ws.dir, 0, 0);
    await workspaces.sweep();
    expect(existsSync(ws.dir)).toBe(false);
    expect(existsSync(worktreePath(folder, "live", root))).toBe(true);
    const again = await workspaces.open(folder, "a");
    expect(read(again.dir, "web", "app.ts")).toBe("agent\n");
  });

  it("leaves a copy another live window uses when this one closes it", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    const checkout = join(ws.dir, "web");
    git(join(folder, "web"), "worktree", "unlock", checkout);
    git(
      join(folder, "web"),
      "worktree",
      "lock",
      "--reason",
      `ignite pid ${process.ppid}`,
      checkout,
    );
    await workspaces.close(folder, "a");
    expect(existsSync(ws.dir)).toBe(true);
  });

  it("never takes a folder the agent made in its copy for a worktree, so it can't widen its sandbox", async () => {
    const ws = await createWorkspaces(root).open(folder, "a");
    const fake = join(base, "fake-gitdir");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(elsewhere);
    git(elsewhere, "init", "-q");
    write(join(ws.dir, "x", ".git"), `gitdir: ${fake}\n`);
    write(join(fake, "commondir"), join(elsewhere, ".git"));
    write(
      join(ws.dir, "web2", ".git"),
      `gitdir: ${join(folder, "web", ".git", "worktrees", "web")}\n`,
    );
    expect(groupCheckouts(ws.dir).sort()).toEqual([
      join(ws.dir, "server"),
      join(ws.dir, "web"),
    ]);
    const access = gitAccess(ws.dir, root);
    expect(access.allow).not.toContain(fake);
    expect(access.allow).not.toContain(join(elsewhere, ".git", "objects"));
    expect(access.common.sort()).toEqual([
      join(folder, "server", ".git"),
      join(folder, "web", ".git"),
    ]);
  });

  it("runs gh's delivery for the worktree its -R names", async () => {
    git(
      join(folder, "web"),
      "remote",
      "add",
      "origin",
      "git@github.com:me/web.git",
    );
    const ws = await createWorkspaces(root).open(folder, "a");
    expect(await ghDir(["pr", "merge", "-R", "me/web"], ws.dir, root)).toBe(
      join(ws.dir, "web"),
    );
    expect(
      await ghDir(["pr", "merge", "--repo", "me/other"], ws.dir, root),
    ).toBe(ws.dir);
    expect(await ghDir(["pr", "merge"], ws.dir, root)).toBe(ws.dir);
    expect(await ghDir(["pr", "merge", "-R", "me/web"], folder, root)).toBe(
      folder,
    );
  });
});
