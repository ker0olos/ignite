// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTrustStore } from "./trust.ts";

let dir: string;
let agentDir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "trust-"));
  agentDir = join(dir, "agent");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const project = async (withPi: boolean) => {
  const cwd = join(dir, withPi ? "with-pi" : "plain");
  await mkdir(withPi ? join(cwd, ".pi", "extensions") : cwd, {
    recursive: true,
  });
  return cwd;
};

it("asks about a folder with its own pi resources until it's decided", async () => {
  const cwd = await project(true);
  const store = createTrustStore(agentDir);
  expect(store.get(cwd)).toBe("ask");
  store.set(cwd, true);
  expect(store.get(cwd)).toBe("trusted");
  store.set(cwd, false);
  expect(store.get(cwd)).toBe("untrusted");
});

it("never asks about a folder with nothing to trust", async () => {
  expect(createTrustStore(agentDir).get(await project(false))).toBe(
    "untrusted",
  );
});

it("keeps decisions in pi's trust.json", async () => {
  const cwd = await project(true);
  createTrustStore(agentDir).set(cwd, true);
  const saved = JSON.parse(
    await readFile(join(agentDir, "trust.json"), "utf8"),
  );
  expect(Object.values(saved)).toEqual([true]);
  expect(createTrustStore(agentDir).get(cwd)).toBe("trusted");
});

it("asks again once the trusted .pi/ changes, here or in a conversation's worktree", async () => {
  const cwd = await project(true);
  const worktree = join(dir, "worktree");
  await mkdir(join(worktree, ".pi", "extensions"), { recursive: true });
  const store = createTrustStore(agentDir);
  store.set(cwd, true);
  expect(store.get(cwd, worktree)).toBe("trusted");
  await writeFile(join(worktree, ".pi", "extensions", "x.ts"), "evil");
  expect(store.get(cwd, worktree)).toBe("ask");
  expect(store.get(cwd)).toBe("trusted");
  store.set(cwd, true, [cwd, worktree]);
  expect(store.get(cwd, worktree)).toBe("trusted");
  await writeFile(join(worktree, ".pi", "extensions", "x.ts"), "eviler");
  expect(createTrustStore(agentDir).get(cwd, worktree)).toBe("ask");
});

it("takes a folder trusted before .pi/ was checked as trusted as it is", async () => {
  const cwd = await project(true);
  createTrustStore(agentDir).set(cwd, true);
  await rm(join(agentDir, "trusted-setup.json"));
  expect(createTrustStore(agentDir).get(cwd)).toBe("trusted");
  await writeFile(join(cwd, ".pi", "settings.json"), "{}");
  expect(createTrustStore(agentDir).get(cwd)).toBe("ask");
});
