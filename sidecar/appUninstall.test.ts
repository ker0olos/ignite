// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { keptItems, uninstall, uninstallTargets } from "./appUninstall.ts";

let dir: string;
let clone: string;
let home: string;
let ignite: string;
const place = () => ({ clone, home, platform: "darwin" as const, env: {} });
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: clone, encoding: "utf8" });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-uninstall-"));
  clone = join(dir, "clone");
  home = join(dir, "home");
  ignite = join(home, ".ignite");
  await mkdir(clone, { recursive: true });
  git("init", "-q");
  await writeFile(join(clone, "README.md"), "hi");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "c");
  // What setup leaves: a version (a worktree) linked to the shared packages, the launcher, user data.
  const packages = join(ignite, "packages", "abc", "node_modules");
  await mkdir(packages, { recursive: true });
  await writeFile(join(packages, "react.js"), "");
  const version = join(ignite, "app", "a".repeat(40));
  git("worktree", "add", "-q", "--detach", version);
  await symlink(packages, join(version, "node_modules"));
  await symlink(packages, join(clone, "node_modules"));
  await mkdir(join(ignite, "pnpm-store"));
  await mkdir(join(home, "Applications", "Ignite.app"), { recursive: true });
  await mkdir(join(ignite, "pi", "sessions"), { recursive: true });
  await writeFile(join(ignite, "settings.toml"), 'theme = "nord"\n');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("uninstall", () => {
  it("removes the launcher and what Ignite keeps to run, and keeps the user's", async () => {
    expect(uninstallTargets(place())).toEqual([
      join(home, "Applications", "Ignite.app"),
      join(ignite, "app"),
      join(ignite, "packages"),
      join(ignite, "pnpm-store"),
    ]);
    expect(keptItems(home).sort()).toEqual(["pi", "settings.toml"]);
    await uninstall(place());
    expect(existsSync(join(home, "Applications", "Ignite.app"))).toBe(false);
    expect(existsSync(join(ignite, "app"))).toBe(false);
    expect(existsSync(join(ignite, "settings.toml"))).toBe(true);
    expect(existsSync(join(ignite, "pi", "sessions"))).toBe(true);
    // The clone's link is gone, and git no longer lists the version's worktree.
    expect(existsSync(join(clone, "node_modules"))).toBe(false);
    expect(git("worktree", "list")).not.toContain("a".repeat(40));
  });

  it("leaves a clone's own node_modules alone", async () => {
    await rm(join(clone, "node_modules"));
    await mkdir(join(clone, "node_modules"));
    await uninstall(place());
    expect(existsSync(join(clone, "node_modules"))).toBe(true);
  });

  it("removes ~/.ignite entirely with all", async () => {
    expect(uninstallTargets(place(), true)).toEqual([
      join(home, "Applications", "Ignite.app"),
      ignite,
    ]);
    await uninstall(place(), true);
    expect(existsSync(ignite)).toBe(false);
  });
});
