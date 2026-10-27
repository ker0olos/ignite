// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { create, remove } from "./worktreeCheckout.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

const DIRS = 20;
const sentinels = Array.from({ length: DIRS }, (_, d) => join(`d${d}`, "keep"));

function bigRepo(base: string) {
  const repo = join(base, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  for (let d = 0; d < DIRS; d++) {
    mkdirSync(join(repo, `d${d}`));
    for (let f = 0; f < 150; f++)
      writeFileSync(join(repo, `d${d}`, `f${f}`), "x");
    writeFileSync(join(repo, sentinels[d]!), "x");
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "init");
  return repo;
}

let base = "";
beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "checkout-")));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

it("adds a worktree again after a crash between moving it out and pruning it", async () => {
  const repo = bigRepo(base);
  const path = join(base, "worktrees", "w", "conv");
  await create(repo, path, "conv");
  git(repo, "worktree", "unlock", path);
  renameSync(path, join(base, "moved"));
  await create(repo, path, "conv");
  expect(existsSync(join(path, sentinels[0]!))).toBe(true);
});

it("never leaves a worktree half-deleted where an open would find it", async () => {
  const repo = bigRepo(base);
  const root = join(base, "worktrees");
  const path = join(root, "w", "conv");
  await create(repo, path, "conv");
  writeFileSync(join(path, "new.txt"), "unsaved work");

  let done = false;
  const removing = remove(path, "conv").finally(() => (done = true));
  let halfDeleted = false;
  while (!done) {
    // A file gone while its folder is still there afterwards; once moved out, it never comes back.
    const missing = !sentinels.every((s) => existsSync(join(path, s)));
    if (missing && existsSync(path)) halfDeleted = true;
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(await removing).toBe(true);
  expect(halfDeleted).toBe(false);
  expect(existsSync(path)).toBe(false);
  expect(readdirSync(root)).toEqual([]);

  await create(repo, path, "conv");
  expect(existsSync(join(path, sentinels.at(-1)!))).toBe(true);
  expect(existsSync(join(path, "new.txt"))).toBe(true);
}, 60_000);
