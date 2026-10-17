// @vitest-environment node
import { existsSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkPackages, pnpmInstall, prunePackages } from "./appPackages.ts";

let dir: string;
let home: string;
const log = () => join(dir, "pnpm.log");
const calls = async () =>
  (await readFile(log(), "utf8").catch(() => "")).trim().split("\n");

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), "app-packages-")));
  home = join(dir, "home");
  vi.stubEnv("FAKE_PNPM_LOG", log());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

// A checkout of a package pinning `packageManager`, with pnpm's lockfiles.
async function checkout(name: string, packageManager = "pnpm@12.14.0") {
  const at = join(dir, name);
  await mkdir(at, { recursive: true });
  const manifest = { packageManager, scripts: { prepare: "x" } };
  await writeFile(join(at, "package.json"), JSON.stringify(manifest));
  await writeFile(join(at, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await writeFile(join(at, "pnpm-workspace.yaml"), "nodeLinker: hoisted\n");
  return at;
}

// Stands in for pnpm: logs where it ran and what with; an install makes node_modules.
async function fakePnpm(version = "12.14.0") {
  const bin = join(home, "pnpm", version, "node_modules", "pnpm", "pnpm");
  await mkdir(join(bin, ".."), { recursive: true });
  await writeFile(
    bin,
    '#!/bin/sh\necho "$PWD $*" >> "$FAKE_PNPM_LOG"\n[ "$1" = install ] && mkdir -p node_modules\nexit 0\n',
  );
  await chmod(bin, 0o755);
}

describe.skipIf(process.platform === "win32")("linkPackages", () => {
  it("installs a lockfile's packages once, and links each checkout with it", async () => {
    await fakePnpm();
    const [a, b] = [await checkout("a"), await checkout("b")];
    await linkPackages(a, { home });
    await linkPackages(b, { home });
    const installs = (await calls()).filter((c) => c.includes(" install "));
    expect(installs).toHaveLength(1);
    expect(installs[0]).toContain("--frozen-lockfile");
    const shared = await realpath(join(a, "node_modules"));
    expect(await realpath(join(b, "node_modules"))).toBe(shared);
    // Its own copy of the manifest, without scripts to run.
    const manifest = await readFile(join(shared, "..", "package.json"), "utf8");
    expect(JSON.parse(manifest)).toEqual({ packageManager: "pnpm@12.14.0" });
  });

  it("updates a node_modules of its own in place only with keepOwn", async () => {
    await fakePnpm();
    const clone = await checkout("clone");
    await mkdir(join(clone, "node_modules"));
    await linkPackages(clone, { keepOwn: true, home });
    expect((await lstat(join(clone, "node_modules"))).isDirectory()).toBe(true);
    expect(await calls()).toEqual([
      `${clone} install --frozen-lockfile --prefer-offline`,
    ]);
    await linkPackages(clone, { home });
    expect((await lstat(join(clone, "node_modules"))).isSymbolicLink()).toBe(
      true,
    );
  });

  it("installs again when an install never finished", async () => {
    await fakePnpm();
    const a = await checkout("a");
    await linkPackages(a, { home });
    const shared = join(await realpath(join(a, "node_modules")), "..");
    await rm(join(shared, "ok"));
    await linkPackages(await checkout("b"), { home });
    expect((await calls()).filter((c) => c.includes(" install "))).toHaveLength(
      2,
    );
  });
});

describe.skipIf(process.platform === "win32")("prunePackages", () => {
  it("removes what no checkout links or pins, and the store with it", async () => {
    await fakePnpm();
    await fakePnpm("11.0.0");
    const a = await checkout("a");
    await linkPackages(a, { home });
    const old = join(home, "packages", "0123456789abcdef");
    await mkdir(old, { recursive: true });
    await writeFile(join(old, "ok"), "");
    await mkdir(join(home, "pnpm-store"));
    await prunePackages([a], { home });
    expect(existsSync(old)).toBe(false);
    expect(existsSync(join(home, "pnpm", "11.0.0"))).toBe(false);
    expect(existsSync(join(home, "pnpm-store"))).toBe(false);
    expect(existsSync(await realpath(join(a, "node_modules")))).toBe(true);
  });

  it("keeps an unfinished install and the store while one is busy", async () => {
    await fakePnpm();
    const a = await checkout("a");
    const unfinished = join(home, "packages", "fedcba9876543210");
    const done = join(home, "packages", "0123456789abcdef");
    await mkdir(unfinished, { recursive: true });
    await mkdir(done, { recursive: true });
    await writeFile(join(done, "ok"), "");
    await mkdir(join(home, "pnpm-store"));
    await prunePackages([a], { busy: true, home });
    expect(existsSync(unfinished)).toBe(true);
    expect(existsSync(done)).toBe(false);
    expect(existsSync(join(home, "pnpm-store"))).toBe(true);
  });
});

it.skipIf(process.platform === "win32")(
  "installs a maintainer's clone in place",
  async () => {
    await fakePnpm();
    const clone = await checkout("clone");
    await pnpmInstall(clone, home);
    expect(await calls()).toEqual([
      `${clone} install --frozen-lockfile --prefer-offline`,
    ]);
  },
);

it("refuses a package that pins no pnpm", async () => {
  for (const packageManager of ["", "npm@11.0.0", "pnpm@latest"]) {
    const clone = await checkout("clone", packageManager);
    await expect(pnpmInstall(clone, home)).rejects.toThrow(
      "pins no pnpm version",
    );
  }
});
