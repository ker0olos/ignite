// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checks, human, sizeOf, space } from "./appDoctor.ts";
import { lockHash } from "./appPackages.ts";

let dir: string;
let clone: string;
let home: string;
const place = () => ({ clone, home, platform: "darwin" as const, env: {} });
const write = async (path: string, text = "") => {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, text);
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "app-doctor-"));
  clone = join(dir, "clone");
  home = join(dir, "home");
  await write(
    join(clone, "package.json"),
    JSON.stringify({ packageManager: "pnpm@12.14.0" }),
  );
  await write(join(clone, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await write(join(clone, "pnpm-workspace.yaml"), "nodeLinker: hoisted\n");
  execFileSync("git", ["init", "-q"], { cwd: clone });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("checks", () => {
  it("says what's missing before setup has run", async () => {
    const report = await checks(place());
    expect(report.map((c) => c.text)).toEqual([
      `Node ${process.versions.node}`,
      "This clone has no origin to update from",
      "pnpm 12.14.0 isn't installed yet",
      "Packages for this lockfile aren't installed",
      "No version has started yet",
      `No launcher at ${join(home, "Applications", "Ignite.app")}: run npm run setup`,
    ]);
    expect(report.map((c) => c.ok)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("finds setup's work: pnpm, the packages, the version, the launcher", async () => {
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://github.com/me/app.git"],
      { cwd: clone },
    );
    const ignite = join(home, ".ignite");
    await mkdir(join(ignite, "pnpm", "12.14.0", "node_modules", "pnpm"), {
      recursive: true,
    });
    const packages = join(ignite, "packages", await lockHash(clone));
    await write(join(packages, "ok"));
    await mkdir(join(packages, "node_modules"));
    await symlink(join(packages, "node_modules"), join(clone, "node_modules"));
    await write(join(ignite, "launch", "good"), "a".repeat(40));
    await write(join(ignite, "launch", "next"), "b".repeat(40));
    await mkdir(join(home, "Applications", "Ignite.app"), { recursive: true });
    const report = await checks(place());
    expect(report.every((c) => c.ok)).toBe(true);
    expect(report.map((c) => c.text)).toContain(
      "Running aaaaaaa; update bbbbbbb ready",
    );
    expect(report.map((c) => c.text)).toContain(
      "Packages for this lockfile installed",
    );
  });
});

describe("space", () => {
  it("sizes what's in ~/.ignite largest first, versions by their short sha, links not followed", async () => {
    const ignite = join(home, ".ignite");
    await write(join(ignite, "pi", "a"), "x".repeat(10));
    await write(join(ignite, "app", "c".repeat(40), "f"), "x".repeat(30));
    await write(join(ignite, "app", "target", "f"), "x".repeat(20));
    await symlink(
      join(ignite, "pi"),
      join(ignite, "app", "c".repeat(40), "node_modules"),
    );
    expect(space(home)).toEqual([
      [
        "app/ccccccc",
        30 + sizeOf(join(ignite, "app", "c".repeat(40), "node_modules")),
      ],
      ["app/target", 20],
      ["pi", 10],
    ]);
  });
});

describe("sizeOf", () => {
  it("counts a hard-linked file once", async () => {
    const { link } = await import("node:fs/promises");
    await write(join(dir, "bin", "pnpm"), "x".repeat(40));
    await link(join(dir, "bin", "pnpm"), join(dir, "bin", "pnpx"));
    expect(sizeOf(join(dir, "bin"))).toBe(40);
  });
});

describe("human", () => {
  it("rounds to the unit", () => {
    expect(human(512)).toBe("512 B");
    expect(human(1536)).toBe("1.5 KB");
    expect(human(38 * 1024 ** 2)).toBe("38 MB");
    expect(human(1.6 * 1024 ** 3)).toBe("1.6 GB");
  });
});
