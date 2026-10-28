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
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whenReady } from "./worktreeReady.ts";
import { createWorkspaces } from "./worktrees.ts";
import {
  folderOf,
  gitAccess,
  groupCheckouts,
  stateRef,
  worktreePath,
} from "./worktreeGit.ts";
import { ghDir, groupRepos } from "./worktreeGroup.ts";
import { checkpointRef } from "./checkpoints.ts";

// Runs while a worktree is being saved, as a conversation opening it then would.
const whileSaving = vi.hoisted(() => ({
  run: undefined as (() => Promise<unknown>) | undefined,
}));
vi.mock("./worktreeGit.ts", async (original) => {
  const real = await original<typeof import("./worktreeGit.ts")>();
  return {
    ...real,
    snapshot: async (...args: Parameters<typeof real.snapshot>) => {
      const run = whileSaving.run;
      whileSaving.run = undefined;
      await run?.();
      return real.snapshot(...args);
    },
  };
});

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
  it("gets its own copy: each repository a detached worktree, its other files copied (its instructions before the session opens)", async () => {
    write(join(folder, "docs", "plan.md"), "plan\n");
    symlinkSync("CLAUDE.md", join(folder, "AGENTS.md"));
    const ws = await createWorkspaces(root).open(folder, "a");
    expect(read(ws.dir, "CLAUDE.md")).toBe("notes\n");
    expect(read(ws.dir, "AGENTS.md")).toBe("notes\n");
    await whenReady(ws.dir);
    expect(ws.dir).toBe(worktreePath(folder, "a", root));
    expect(read(ws.dir, "server", "app.ts")).toBe("server\n");
    expect(read(ws.dir, "web", "app.ts")).toBe("web\n");
    expect(read(ws.dir, "docs", "plan.md")).toBe("plan\n");
    expect(existsSync(join(ws.dir, "empty"))).toBe(false);
    expect(git(join(ws.dir, "web"), "branch", "--show-current")).toBe("");
    expect(
      git(join(folder, "web"), "worktree", "list").split("\n"),
    ).toHaveLength(2);
  });

  it("links what the folder links inside it to the copy's own, also in a copy made before", async () => {
    symlinkSync("web", join(folder, ".agent"));
    symlinkSync(join(base, "elsewhere"), join(folder, "outside"));
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    await whenReady(ws.dir);
    expect(realpathSync(join(ws.dir, ".agent"))).toBe(join(ws.dir, "web"));
    expect(existsSync(join(ws.dir, "outside"))).toBe(false);
    rmSync(join(ws.dir, ".agent"));
    await workspaces.open(folder, "a");
    expect(read(ws.dir, ".agent", "app.ts")).toBe("web\n");
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

  it("keeps a copy whose app is gone, for its conversation to reopen", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
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
    const again = await createWorkspaces(root).open(folder, "a");
    expect(read(again.dir, "web", "app.ts")).toBe("agent\n");
    expect(read(again.dir, "server", "app.ts")).toBe("server\n");
  });

  it("takes back every worktree of a copy reopened while it's being closed, checkpoints and all", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    write(join(ws.dir, "web", "app.ts"), "agent\n");
    for (const name of ["server", "web"]) {
      const repo = join(folder, name);
      git(repo, "update-ref", checkpointRef("a", "e1"), "HEAD");
    }
    let opened: Promise<unknown> | undefined;
    // Not awaited: the open runs on while git removes the worktree just saved.
    whileSaving.run = async () => {
      opened = workspaces.open(folder, "a");
    };
    await workspaces.close(folder, "a");
    await opened;
    expect(read(ws.dir, "web", "app.ts")).toBe("agent\n");
    expect(read(ws.dir, "server", "app.ts")).toBe("server\n");
    expect(groupCheckouts(ws.dir)).toHaveLength(2);
    for (const name of ["server", "web"])
      expect(
        git(join(folder, name), "rev-parse", checkpointRef("a", "e1")),
      ).toBeTruthy();
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

  it("saves a repository that is itself a linked worktree of another, like any", async () => {
    const main = join(base, "main-repo");
    mkdirSync(main);
    git(main, "init", "-q", "-b", "main");
    git(main, "commit", "-q", "--allow-empty", "-m", "init");
    git(main, "worktree", "add", "-q", "-b", "side", join(folder, "linked"));
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    expect(groupCheckouts(ws.dir)).toContain(join(ws.dir, "linked"));
    write(join(ws.dir, "linked", "made.ts"), "made\n");
    await workspaces.close(folder, "a");
    const again = await workspaces.open(folder, "a");
    expect(read(again.dir, "linked", "made.ts")).toBe("made\n");
  });

  it("reads gh's -R in every form", async () => {
    git(
      join(folder, "web"),
      "remote",
      "add",
      "origin",
      "git@github.com:me/web.git",
    );
    const ws = await createWorkspaces(root).open(folder, "a");
    const web = join(ws.dir, "web");
    for (const flag of [["--repo=me/web"], ["-Rme/web"], ["-R", "me/web"]]) {
      expect(await ghDir(["pr", "merge", ...flag], ws.dir, root)).toBe(web);
    }
  });

  it("leaves no half-made worktree when one fails to open, so the next open makes it", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(folder, "a");
    const api = repoIn("api");
    // A saved state with no parent can't be restored.
    const orphan = git(
      api,
      "commit-tree",
      git(api, "rev-parse", "HEAD^{tree}"),
      "-m",
      "x",
    );
    git(api, "update-ref", stateRef("a"), orphan);
    await expect(workspaces.open(folder, "a")).rejects.toThrow();
    expect(existsSync(join(ws.dir, "api"))).toBe(false);
    expect(existsSync(join(ws.dir, "web"))).toBe(true);
    expect(git(api, "worktree", "list").split("\n")).toHaveLength(1);
    git(api, "update-ref", "-d", stateRef("a"));
    await workspaces.open(folder, "a");
    expect(read(ws.dir, "api", "app.ts")).toBe("api\n");
  });
});
