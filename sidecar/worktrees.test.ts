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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaces, updateFolder } from "./worktrees.ts";
import { prefetch, startPoint } from "./worktreeCheckout.ts";
import {
  folderOf,
  gitAccess,
  worktreeBase,
  worktreePath,
} from "./worktreeGit.ts";
import { cloneIgnored } from "./worktreeClone.ts";
import { setReady, startReady, whenReady } from "./worktreeReady.ts";
import { checkpointRef } from "./checkpoints.ts";

let base: string;
let repo: string;
let root: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const read = (...path: string[]) => readFileSync(join(...path), "utf8");
const write = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "worktrees-")));
  repo = join(base, "repo");
  root = join(base, "worktrees");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  write(join(repo, ".gitignore"), "node_modules/\n.env\n");
  write(join(repo, "app.ts"), "one\n");
  write(join(repo, "sub", "lib.ts"), "lib\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

/** Makes a worktree look old enough for a sweep to consider. */
const age = (path: string) => utimesSync(path, 0, 0);

/** Gives the repository an origin with main pushed; returns its path. */
const withRemote = () => {
  const remote = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", remote);
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "-q", "-u", "origin", "main");
  git(repo, "remote", "set-head", "origin", "main");
  return remote;
};

describe("workspaces", () => {
  it("shares a folder that isn't in git", async () => {
    const plain = join(base, "plain");
    mkdirSync(plain);
    const ws = await createWorkspaces(root).open(plain, "a");
    expect(ws.dir).toBe(plain);
  });

  it("calls back just before it removes a conversation's worktree", async () => {
    const ws = createWorkspaces(root);
    const { dir } = await ws.open(repo, "a");
    let there = false;
    await ws.close(repo, "a", async () => void (there = existsSync(dir)));
    expect(there).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it("lets a worktree's clone finish before removing it", async () => {
    const ws = createWorkspaces(root);
    const { dir } = await ws.open(repo, "a");
    let cloned = () => {};
    setReady(dir, () => new Promise<void>((resolve) => (cloned = resolve)));
    startReady(dir);
    const closing = ws.close(repo, "a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(existsSync(dir)).toBe(true);
    cloned();
    await closing;
    expect(existsSync(dir)).toBe(false);
  });

  it("skips the clone of a worktree closed before it started", async () => {
    const ws = createWorkspaces(root);
    const { dir } = await ws.open(repo, "a");
    const clone = vi.fn(async () => {});
    setReady(dir, clone);
    await ws.close(repo, "a");
    await whenReady(dir);
    expect(clone).not.toHaveBeenCalled();
  });

  it("says where a folder's conversations work before opening any", async () => {
    const ws = createWorkspaces(root);
    const opened = await ws.open(join(repo, "sub"), "a");
    const { base: at, prefix } = (await ws.layout(join(repo, "sub")))!;
    expect(join(at, "a", prefix)).toBe(opened.dir);
    expect(await ws.layout(repo)).toEqual({ base: at, prefix: "" });
    // A folder of repositories: a copy of it per conversation.
    expect(await ws.layout(base)).toEqual({
      base: worktreeBase(base, root),
      prefix: "",
    });
    const plain = join(base, "plain");
    mkdirSync(plain);
    expect(await ws.layout(plain)).toBeNull();
  });

  it("starts from the remote's default branch as fetched when the folder showed, without the user's own work", async () => {
    const remote = withRemote();
    const other = join(base, "other");
    git(base, "clone", "-q", remote, other);
    write(join(other, "app.ts"), "merged\n");
    git(other, "commit", "-q", "-am", "merged elsewhere");
    git(other, "push", "-q");
    write(join(repo, "app.ts"), "user's wip\n");
    write(join(repo, "wip.ts"), "wip\n");
    const workspaces = createWorkspaces(root);
    await workspaces.layout(repo);
    await prefetch(repo);
    const ws = await workspaces.open(repo, "a");
    expect(ws.dir).toBe(worktreePath(repo, "a", root));
    expect(read(ws.dir, "app.ts")).toBe("merged\n");
    expect(existsSync(join(ws.dir, "wip.ts"))).toBe(false);
    expect(git(ws.dir, "status", "--porcelain")).toBe("");
    expect(git(ws.dir, "branch", "--show-current")).toBe("");
    expect(read(repo, "app.ts")).toBe("user's wip\n");
  });

  it("starts from the folder's HEAD when it has no remote", async () => {
    expect(await startPoint(repo)).toBe("HEAD");
    withRemote();
    expect(await startPoint(repo)).toBe("origin/main");
  });

  it("gives an agent the folder's ignored files", async () => {
    write(join(repo, ".env"), "KEY=1\n");
    write(join(repo, "node_modules", "dep", "index.js"), "dep\n");
    const ws = await createWorkspaces(root).open(repo, "a");
    await whenReady(ws.dir);
    expect(read(ws.dir, ".env")).toBe("KEY=1\n");
    expect(read(ws.dir, "node_modules", "dep", "index.js")).toBe("dep\n");
  });

  it.each([
    ["can't clone", null],
    ["fails to clone", ["--no-such-flag"]],
  ])(
    "copies only ignored files, not folders, where the filesystem %s",
    async (_, flags) => {
      write(join(repo, ".env"), "KEY=1\n");
      write(join(repo, "node_modules", "dep", "index.js"), "dep\n");
      const into = join(base, "into");
      mkdirSync(into);
      await cloneIgnored(repo, into, flags, false);
      expect(read(into, ".env")).toBe("KEY=1\n");
      expect(existsSync(join(into, "node_modules"))).toBe(false);
    },
  );

  it.runIf(process.platform === "darwin")(
    "clones a whole ignored folder in one call, and falls back to cp where it can't",
    async () => {
      write(join(repo, "node_modules", "dep", "index.js"), "dep\n");
      write(join(repo, ".env"), "KEY=1\n");
      const into = join(base, "into");
      // .env is there already, so clonefile refuses it and cp copies it over.
      write(join(into, ".env"), "stale\n");
      await cloneIgnored(repo, into);
      expect(read(into, "node_modules", "dep", "index.js")).toBe("dep\n");
      expect(read(into, ".env")).toBe("KEY=1\n");
    },
  );

  it("runs a subfolder's agent in the same subfolder of its worktree", async () => {
    const ws = await createWorkspaces(root).open(join(repo, "sub"), "a");
    expect(read(ws.dir, "lib.ts")).toBe("lib\n");
    expect(folderOf(ws.dir, root)).toBe(join(repo, "sub"));
    expect(folderOf(repo, root)).toBe(repo);
    const own = join(repo, ".git", "worktrees", "a");
    expect(gitAccess(ws.dir, root)).toEqual({
      allow: [own, join(repo, ".git", "objects")],
      deny: [
        join(worktreePath(repo, "a", root), ".git"),
        join(own, "commondir"),
        join(own, "gitdir"),
        join(own, "config.worktree"),
        join(own, "locked"),
      ],
      common: [join(repo, ".git")],
    });
    expect(gitAccess(repo, root)).toEqual({ allow: [], deny: [], common: [] });
  });

  it("maps back to the user's folder when that is itself a linked worktree", async () => {
    const linked = join(base, "linked");
    git(repo, "worktree", "add", "-q", "-b", "feature", linked);
    const ws = await createWorkspaces(root).open(linked, "a");
    expect(folderOf(ws.dir, root)).toBe(linked);
  });

  it("keeps an agent's work when its worktree is closed, and brings it back", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(repo, "a");
    write(join(ws.dir, "app.ts"), "agent\n");
    write(join(ws.dir, "made.ts"), "made\n");
    await workspaces.close(repo, "a");
    expect(existsSync(join(worktreePath(repo, "a", root), ".."))).toBe(false);
    expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1);
    const again = await workspaces.open(repo, "a");
    expect(read(again.dir, "app.ts")).toBe("agent\n");
    expect(read(again.dir, "made.ts")).toBe("made\n");
  });

  it("deletes the conversation's checkpoints with its worktree, and no one else's", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(repo, "a");
    const head = git(repo, "rev-parse", "HEAD");
    git(repo, "update-ref", checkpointRef("a", "e1"), head);
    git(repo, "update-ref", checkpointRef("b", "e1"), head);
    await workspaces.close(repo, "a");
    const refs = git(repo, "for-each-ref", "--format=%(refname)");
    expect(refs).not.toContain(checkpointRef("a", "e1"));
    expect(refs).toContain(checkpointRef("b", "e1"));
    expect(existsSync(ws.dir)).toBe(false);
  });

  it("starts a fork's worktree as a copy of its original's files, on no branch", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(repo, "a");
    git(ws.dir, "switch", "-q", "-c", "feat/x");
    write(join(ws.dir, "app.ts"), "agent\n");
    write(join(ws.dir, "made.ts"), "made\n");
    await workspaces.fork(repo, "a", "b");
    const fork = await workspaces.open(repo, "b");
    expect(read(fork.dir, "app.ts")).toBe("agent\n");
    expect(read(fork.dir, "made.ts")).toBe("made\n");
    expect(git(fork.dir, "branch", "--show-current")).toBe("");
    expect(read(ws.dir, "app.ts")).toBe("agent\n");
    await workspaces.close(repo, "a");
    await workspaces.fork(repo, "a", "d");
    const saved = await workspaces.open(repo, "d");
    expect(read(saved.dir, "made.ts")).toBe("made\n");
    expect(git(saved.dir, "branch", "--show-current")).toBe("");
    expect(
      git((await workspaces.open(repo, "a")).dir, "branch", "--show-current"),
    ).toBe("feat/x");
    await workspaces.fork(repo, "missing", "c");
    expect(read((await workspaces.open(repo, "c")).dir, "app.ts")).toBe(
      "one\n",
    );
  });

  it("sweeps worktrees whose app is gone, keeping their work", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(repo, "a");
    await workspaces.open(repo, "live");
    write(join(ws.dir, "app.ts"), "agent\n");
    const path = worktreePath(repo, "a", root);
    git(repo, "worktree", "unlock", path);
    git(repo, "worktree", "lock", "--reason", "ignite pid 999999", path);
    age(path);
    await workspaces.sweep();
    expect(existsSync(path)).toBe(false);
    expect(existsSync(worktreePath(repo, "live", root))).toBe(true);
    expect(read((await workspaces.open(repo, "a")).dir, "app.ts")).toBe(
      "agent\n",
    );
  });

  it("opens again a worktree whose folder was deleted while locked", async () => {
    const workspaces = createWorkspaces(root);
    const path = worktreePath(repo, "a", root);
    await workspaces.open(repo, "a");
    rmSync(join(path, ".."), { recursive: true, force: true });
    expect((await workspaces.open(repo, "a")).dir).toBe(path);
    expect(read(path, "app.ts")).toBe("one\n");
  });

  it("removes a worktree whose repository is gone", async () => {
    const workspaces = createWorkspaces(root);
    await workspaces.open(repo, "a");
    rmSync(repo, { recursive: true, force: true });
    age(worktreePath(repo, "a", root));
    await workspaces.sweep();
    expect(readdirSync(root)).toEqual([]);
  });
});

describe("keeping work safe", () => {
  it("brings back the branch the agent was on when its conversation reopens", async () => {
    const workspaces = createWorkspaces(root);
    const ws = await workspaces.open(repo, "a");
    git(ws.dir, "switch", "-q", "-c", "feat/x");
    write(join(ws.dir, "app.ts"), "agent\n");
    git(
      ws.dir,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-qam",
      "x",
    );
    write(join(ws.dir, "app.ts"), "more\n");
    await workspaces.close(repo, "a");
    const again = await workspaces.open(repo, "a");
    expect(git(again.dir, "branch", "--show-current")).toBe("feat/x");
    expect(read(again.dir, "app.ts")).toBe("more\n");
  });

  it("keeps a worktree it couldn't save", async () => {
    const workspaces = createWorkspaces(root);
    await workspaces.open(repo, "a");
    const path = worktreePath(repo, "a", root);
    // A broken index makes the snapshot fail.
    const index = git(
      path,
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      "index",
    );
    write(index, "not an index");
    await expect(workspaces.close(repo, "a")).rejects.toThrow();
    expect(existsSync(path)).toBe(true);
  });

  it("takes over a crashed app's worktree when it reopens, so sweeps leave it be", async () => {
    const workspaces = createWorkspaces(root);
    await workspaces.open(repo, "a");
    const path = worktreePath(repo, "a", root);
    git(repo, "worktree", "unlock", path);
    git(repo, "worktree", "lock", "--reason", "ignite pid 999999", path);
    await workspaces.open(repo, "a");
    age(path);
    await workspaces.sweep();
    expect(existsSync(path)).toBe(true);
  });

  it("leaves a worktree another live window uses when this one closes it", async () => {
    const workspaces = createWorkspaces(root);
    await workspaces.open(repo, "a");
    const path = worktreePath(repo, "a", root);
    git(repo, "worktree", "unlock", path);
    git(
      repo,
      "worktree",
      "lock",
      "--reason",
      `ignite pid ${process.ppid}`,
      path,
    );
    await workspaces.close(repo, "a");
    expect(existsSync(path)).toBe(true);
  });

  it("leaves a new worktree alone even before it's locked", async () => {
    const workspaces = createWorkspaces(root);
    await workspaces.open(repo, "a");
    const path = worktreePath(repo, "a", root);
    git(repo, "worktree", "unlock", path);
    await workspaces.sweep();
    expect(existsSync(path)).toBe(true);
  });
});

describe("updateFolder", () => {
  /** Pushes a commit to the folder's remote, as a merged pull request would. */
  const merge = (text: string) => {
    const other = join(base, `other-${text}`);
    git(base, "clone", "-q", join(base, "remote.git"), other);
    write(join(other, "app.ts"), text);
    git(other, "commit", "-q", "-am", text);
    git(other, "push", "-q");
  };

  it("fast-forwards the folder once the agent's work is merged", async () => {
    withRemote();
    merge("merged\n");
    expect(await updateFolder(repo)).toBe(
      "The user's folder (on main) is now up to date with its remote.",
    );
    expect(read(repo, "app.ts")).toBe("merged\n");
  });

  it("leaves the folder alone when the user's changes are in the way", async () => {
    withRemote();
    merge("merged\n");
    write(join(repo, "app.ts"), "user's wip\n");
    expect(await updateFolder(repo)).toMatch(
      /^The user's folder \(on main\) was left as is: /,
    );
    expect(read(repo, "app.ts")).toBe("user's wip\n");
  });

  it("leaves a folder that isn't on a branch alone", async () => {
    git(repo, "checkout", "-q", "--detach");
    expect(await updateFolder(repo)).toBe(
      "The user's folder isn't on a branch, so it was left as is.",
    );
  });
});
