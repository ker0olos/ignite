// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fileImages } from "./gitImages.ts";

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const data = (text: string) => Buffer.from(text).toString("base64");
const commit = async (text: string) => {
  await writeFile(join(repo, "a.png"), text);
  git("add", ".");
  git("commit", "-qm", text);
  return git("rev-parse", "HEAD");
};

beforeEach(async () => {
  repo = await realpath(await mkdtemp(join(tmpdir(), "git-images-")));
  vi.stubEnv("GIT_AUTHOR_NAME", "Me");
  vi.stubEnv("GIT_AUTHOR_EMAIL", "me@example.com");
  vi.stubEnv("GIT_COMMITTER_NAME", "Me");
  vi.stubEnv("GIT_COMMITTER_EMAIL", "me@example.com");
  git("init", "-q", "-b", "main");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(repo, { recursive: true, force: true });
});

const sides = async (range: string, path = "a.png") => {
  const { before, after } = await fileImages(repo, range, path);
  return [before?.data, after?.data];
};

it("reads both versions of each kind of range", async () => {
  const one = await commit("one");
  const two = await commit("two");
  await writeFile(join(repo, "a.png"), "staged");
  git("add", ".");
  await writeFile(join(repo, "a.png"), "disk");
  expect(await sides("HEAD")).toEqual([data("two"), data("disk")]);
  expect(await sides("staged")).toEqual([data("two"), data("staged")]);
  expect(await sides(`${two}^!`)).toEqual([data("one"), data("two")]);
  expect(await sides(`${one}..${two}`)).toEqual([data("one"), data("two")]);
  expect(await sides(`${one}...${two}`)).toEqual([data("one"), data("two")]);
  const { after } = await fileImages(repo, "HEAD", "a.png");
  expect(after?.mimeType).toBe("image/png");
});

it("leaves out the side an added or deleted image lacks", async () => {
  await commit("one");
  await writeFile(join(repo, "b.png"), "new");
  expect(await sides("HEAD", "b.png")).toEqual([undefined, data("new")]);
  git("rm", "-q", "a.png");
  expect(await sides("staged")).toEqual([data("one"), undefined]);
});

it("fails for a range whose start isn't found", async () => {
  await commit("one");
  await expect(fileImages(repo, "aaaa...bbbb", "a.png")).rejects.toThrow(
    "Couldn't find where aaaa...bbbb starts.",
  );
});

it("refuses a pull request's range, other files and paths outside the repository", async () => {
  await expect(fileImages(repo, "gh:o/r:main...x", "a.png")).rejects.toThrow(
    "Can't show images",
  );
  await expect(fileImages(repo, "--output=x", "a.png")).rejects.toThrow(
    "Can't show images",
  );
  await expect(fileImages(repo, "HEAD", "a.txt")).rejects.toThrow(
    "isn't an image",
  );
  await expect(fileImages(repo, "HEAD", "../x.png")).rejects.toThrow(
    "isn't an image",
  );
});
