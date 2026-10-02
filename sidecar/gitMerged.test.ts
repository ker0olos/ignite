import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
const gitOr = vi.fn();
vi.mock("./gitRun.ts", () => ({ run }));
vi.mock("./worktreeGit.ts", () => ({ gitOr }));

const { refuseMerged } = await import("./gitMerged.ts");

const json = (value: unknown) => ({ code: 0, output: JSON.stringify(value) });
const MERGED = {
  number: 7,
  state: "MERGED",
  baseRefName: "main",
  headRefOid: "head7",
  mergeCommit: { oid: "merge7" },
};

let branch: string | null;
let ancestors: Set<string>;
let byHead: unknown;
let byBase: unknown;

beforeEach(() => {
  branch = "fix/old";
  ancestors = new Set(["head7"]);
  byHead = json([MERGED]);
  byBase = json([]);
  gitOr.mockReset();
  gitOr.mockImplementation(async (_repo: string, args: string[]) => {
    if (args[0] === "branch") return branch && `${branch}\n`;
    if (args[0] === "rev-parse") return "origin/main\n";
    return ancestors.has(args[2]) ? "" : null;
  });
  run.mockReset();
  run.mockImplementation(async (_gh: string, args: string[]) =>
    args.includes("--head") ? byHead : byBase,
  );
});

const commit = () => refuseMerged("git", ["commit", "-m", "x"], "/r");

describe("refuseMerged", () => {
  it("refuses a commit continuing a branch whose pull request was merged", async () => {
    await expect(commit()).rejects.toThrow(
      "fix/old's pull request #7 was already merged into main",
    );
    expect(run.mock.calls[0][1]).toEqual(
      expect.arrayContaining(["--head", "fix/old"]),
    );
    expect(run.mock.calls[0][2].cwd).toBe("/r");
  });

  it("checks the repository -C names and the branch a push names", async () => {
    await expect(
      refuseMerged(
        "git",
        ["-C", "api", "push", "-u", "origin", "work:feat/x"],
        "/r",
      ),
    ).rejects.toThrow("feat/x's pull request");
    expect(run.mock.calls[0][2].cwd).toBe("/r/api");
    expect(gitOr).toHaveBeenCalledWith("/r/api", [
      "merge-base",
      "--is-ancestor",
      "head7",
      "work",
    ]);
  });

  it("allows a new branch of the same name: from main after the merge, or never holding it", async () => {
    ancestors = new Set(["head7", "merge7"]);
    await expect(commit()).resolves.toBeUndefined();
    ancestors = new Set();
    await expect(commit()).resolves.toBeUndefined();
  });

  it("allows a branch others' pull requests target, like develop", async () => {
    byBase = json([{ number: 3 }]);
    await expect(commit()).resolves.toBeUndefined();
    byBase = { code: 1, output: "offline" };
    await expect(commit()).resolves.toBeUndefined();
  });

  it("allows an open pull request, or none merged", async () => {
    byHead = json([MERGED, { ...MERGED, number: 9, state: "OPEN" }]);
    await expect(commit()).resolves.toBeUndefined();
    byHead = json([{ ...MERGED, state: "CLOSED", mergeCommit: null }]);
    await expect(commit()).resolves.toBeUndefined();
  });

  it("skips the default branch, other commands, gh, and no branch", async () => {
    branch = "main";
    await commit();
    await refuseMerged("git", ["status"], "/r");
    await refuseMerged("gh", ["pr", "create"], "/r");
    branch = null;
    await commit();
    expect(run).not.toHaveBeenCalled();
  });

  it("goes ahead when GitHub can't tell", async () => {
    byHead = { code: 1, output: "no git remotes found" };
    await expect(commit()).resolves.toBeUndefined();
    byHead = { code: 0, output: "not json" };
    await expect(commit()).resolves.toBeUndefined();
    run.mockRejectedValueOnce(new Error("gh isn't installed"));
    await expect(commit()).resolves.toBeUndefined();
  });

  it("gives gh the call's stop signal, with a time limit", async () => {
    const stop = new AbortController();
    await refuseMerged("git", ["commit"], "/r", stop.signal).catch(() => {});
    const signal = run.mock.calls[0][2].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    stop.abort();
    expect(signal.aborted).toBe(true);
  });
});
