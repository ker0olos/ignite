// @vitest-environment node
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { binaryOf, isBuilt, modsHash, viteEnv } from "./appBuild.ts";

let mods: string;

beforeEach(async () => {
  mods = await mkdtemp(join(tmpdir(), "mods-"));
});
afterEach(() => rm(mods, { recursive: true, force: true }));

describe("modsHash", () => {
  it("is plain with no mods, an empty folder or a missing one", async () => {
    expect(await modsHash("")).toBe("plain");
    expect(await modsHash(mods)).toBe("plain");
    expect(await modsHash(join(mods, "nope"))).toBe("plain");
  });

  it("ignores git, dependencies and Finder's files", async () => {
    await mkdir(join(mods, ".git"));
    await writeFile(join(mods, ".git", "HEAD"), "ref");
    await mkdir(join(mods, "node_modules"));
    await writeFile(join(mods, "node_modules", "x.js"), "");
    await writeFile(join(mods, ".DS_Store"), "");
    expect(await modsHash(mods)).toBe("plain");
  });

  it("changes when a mod is added or edited, and not otherwise", async () => {
    await mkdir(join(mods, "src"));
    const file = join(mods, "src", "App.tsx");
    await writeFile(file, "a");
    const first = await modsHash(mods);
    expect(first).toMatch(/^[0-9a-f]{12}$/);
    expect(await modsHash(mods)).toBe(first);
    await writeFile(file, "ab");
    const edited = await modsHash(mods);
    expect(edited).not.toBe(first);
    await utimes(file, new Date(), new Date(Date.now() + 5000));
    expect(await modsHash(mods)).not.toBe(edited);
  });
});

describe("binaryOf", () => {
  it("is in the version's build folder", () => {
    expect(binaryOf("/v")).toMatch(/^[/\\]v[/\\]build[/\\]/);
  });
});

describe("isBuilt", () => {
  it("only once the build's marker is written", async () => {
    expect(isBuilt(mods)).toBe(false);
    await mkdir(join(mods, "build"));
    await writeFile(join(mods, "build", "ok"), "");
    expect(isBuilt(mods)).toBe(true);
  });
});

describe("viteEnv", () => {
  it("passes the mods and turns live reload on", () => {
    expect(viteEnv("/m")).toMatchObject({
      IGNITE_MODS: "/m",
      IGNITE_LIVE_RELOAD: "1",
    });
    expect(viteEnv("").IGNITE_HEALTH_FILE).toMatch(/healthy$/);
  });
});
