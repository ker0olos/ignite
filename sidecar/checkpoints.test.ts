// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkpointRef,
  dropCheckpoints,
  keepCheckpoint,
  restoreCheckpoint,
  restoreState,
  takeCheckpoint,
} from "./checkpoints.ts";

let base: string;
let repo: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const read = (...path: string[]) => readFileSync(join(...path), "utf8");
const write = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "checkpoints-")));
  repo = join(base, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  write(join(repo, ".gitignore"), "node_modules/\n");
  write(join(repo, "app.ts"), "one\n");
  write(join(repo, "gone.ts"), "gone\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

/** Saves `dir`'s files as conversation s1's checkpoint for entry e1. */
async function checkpoint(dir = repo) {
  const commit = await takeCheckpoint(dir);
  expect(commit).toMatch(/^[0-9a-f]{40}$/);
  expect(await keepCheckpoint(dir, "s1", "e1", commit!)).toBe(true);
}

describe("checkpoints", () => {
  it("keeps the working state under its own ref, moving no branch and leaving the index", async () => {
    const head = git(repo, "rev-parse", "HEAD");
    write(join(repo, "app.ts"), "two\n");
    write(join(repo, "new.ts"), "new\n");
    await checkpoint();
    expect(git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(git(repo, "rev-parse", "main")).toBe(head);
    expect(git(repo, "diff", "--cached", "--name-only")).toBe("");
    const ref = checkpointRef("s1", "e1");
    expect(ref).toBe("refs/ignite/checkpoints/s1/e1");
    expect(git(repo, "show", `${ref}:app.ts`)).toBe("two");
    expect(git(repo, "show", `${ref}:new.ts`)).toBe("new");
  });

  it("puts tracked and untracked files back as they were, leaving ignored ones", async () => {
    write(join(repo, "kept.ts"), "untracked then\n");
    await checkpoint();
    write(join(repo, "app.ts"), "changed\n");
    rmSync(join(repo, "gone.ts"));
    rmSync(join(repo, "kept.ts"));
    write(join(repo, "later", "added.ts"), "added\n");
    write(join(repo, "node_modules", "dep.js"), "dep\n");
    git(repo, "add", "app.ts");
    expect(await restoreCheckpoint(repo, "s1", "e1")).toBe(true);
    expect(read(repo, "app.ts")).toBe("one\n");
    expect(read(repo, "gone.ts")).toBe("gone\n");
    expect(read(repo, "kept.ts")).toBe("untracked then\n");
    expect(existsSync(join(repo, "later"))).toBe(false);
    expect(read(repo, "node_modules", "dep.js")).toBe("dep\n");
    expect(git(repo, "diff", "--cached", "--name-only")).toBe("");
    expect(git(repo, "status", "--porcelain")).toBe("?? kept.ts");
  });

  it("restores the whole worktree from a subfolder", async () => {
    write(join(repo, "sub", "lib.ts"), "lib\n");
    await checkpoint(join(repo, "sub"));
    write(join(repo, "app.ts"), "changed\n");
    expect(await restoreCheckpoint(join(repo, "sub"), "s1", "e1")).toBe(true);
    expect(read(repo, "app.ts")).toBe("one\n");
  });

  it("sees a same-size edit made the moment after a checkpoint", async () => {
    await checkpoint();
    const later = await takeCheckpoint(repo);
    write(join(repo, "app.ts"), "two\n");
    expect(await restoreCheckpoint(repo, "s1", "e1")).toBe(true);
    expect(read(repo, "app.ts")).toBe("one\n");
    write(join(repo, "app.ts"), "six\n");
    await restoreState(repo, later!);
    expect(read(repo, "app.ts")).toBe("one\n");
  });

  it("deletes nothing when the state can't be read", async () => {
    write(join(repo, "new.ts"), "new\n");
    await expect(restoreState(repo, "0".repeat(40))).rejects.toThrow();
    expect(read(repo, "new.ts")).toBe("new\n");
  });

  it("puts back any commit of the working state, as the undo of a rewind", async () => {
    write(join(repo, "app.ts"), "mine\n");
    const undo = await takeCheckpoint(repo);
    write(join(repo, "app.ts"), "theirs\n");
    await restoreState(repo, undo!);
    expect(read(repo, "app.ts")).toBe("mine\n");
  });

  it("leaves the files when the message has no checkpoint", async () => {
    write(join(repo, "app.ts"), "changed\n");
    expect(await restoreCheckpoint(repo, "s1", "e1")).toBe(false);
    expect(read(repo, "app.ts")).toBe("changed\n");
  });

  it("takes none outside git, and fails to keep one quietly", async () => {
    const plain = join(base, "plain");
    mkdirSync(plain);
    expect(await takeCheckpoint(plain)).toBeNull();
    expect(await keepCheckpoint(repo, "s1", "e1", "not-a-commit")).toBe(false);
  });

  it("drops only that conversation's checkpoints", async () => {
    await checkpoint();
    const head = git(repo, "rev-parse", "HEAD");
    git(repo, "update-ref", checkpointRef("s1", "e2"), head);
    git(repo, "update-ref", checkpointRef("s10", "e1"), head);
    await dropCheckpoints(repo, "s1");
    expect(git(repo, "for-each-ref", "--format=%(refname)")).toBe(
      ["refs/heads/main", checkpointRef("s10", "e1")].sort().join("\n"),
    );
  });

  it("drops nothing outside git", async () => {
    await expect(dropCheckpoints(base, "s1")).resolves.toBeUndefined();
  });
});
