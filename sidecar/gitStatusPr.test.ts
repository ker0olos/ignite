// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gh = vi.hoisted(() => vi.fn());
vi.mock("./gitMerged.ts", () => ({ gh }));
const { gitStatus } = await import("./gitStatus.ts");

let root: string;
let app: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: app, encoding: "utf8" });
const pr = (number: number, isCrossRepository = false) => ({
  number,
  url: `https://github.com/me/app/pull/${number}`,
  state: "OPEN",
  isDraft: false,
  isCrossRepository,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  root = await realpath(await mkdtemp(join(tmpdir(), "git-status-pr-")));
  app = join(root, "app");
  execFileSync("git", ["init", "-q", "-b", "feat", "app"], { cwd: root });
  git(
    "-c",
    "user.name=Me",
    "-c",
    "user.email=me@x",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "one",
  );
});
afterEach(async () => {
  vi.useRealTimers();
  gh.mockReset();
  await rm(root, { recursive: true, force: true });
});

const shownPr = async () => (await gitStatus([], app))[0].pr?.number;

it("waits for GitHub only the first time, then answers with the last known pull request while asking again", async () => {
  gh.mockResolvedValueOnce([pr(9, true), pr(1)]);
  expect(await shownPr()).toBe(1);

  let answer!: (list: unknown) => void;
  gh.mockReturnValueOnce(new Promise((r) => (answer = r)));
  vi.setSystemTime(Date.now() + 31_000);
  expect(await shownPr()).toBe(1);
  expect(gh).toHaveBeenCalledTimes(2);
  // Still asking: no second question in the meantime.
  expect(await shownPr()).toBe(1);
  expect(gh).toHaveBeenCalledTimes(2);

  answer([pr(2)]);
  await vi.waitFor(async () => expect(await shownPr()).toBe(2));
});

it("keeps the last known pull request when GitHub can't answer", async () => {
  gh.mockResolvedValueOnce([pr(1)]);
  expect(await shownPr()).toBe(1);
  gh.mockResolvedValueOnce(null);
  vi.setSystemTime(Date.now() + 31_000);
  await shownPr();
  await vi.waitFor(() => expect(gh).toHaveBeenCalledTimes(2));
  expect(await shownPr()).toBe(1);
});
