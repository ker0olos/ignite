import { describe, expect, it } from "vitest";
import { ghApproval, gitApproval, splitGit, taskRunsAlone } from "./gitPolicy";

const place = { cwd: "/Users/me/app", home: "/Users/me" };
const git = (line: string) => gitApproval(line.split(" "), place);
const gh = (line: string) => ghApproval(line.split(" "), place);

describe("splitGit", () => {
  it("skips global options to find the subcommand and -C's folder", () => {
    expect(splitGit(["-C", "server", "--no-pager", "log", "-3"])).toEqual({
      globals: ["-C", "server", "--no-pager"],
      command: "log",
      rest: ["-3"],
      dir: "server",
    });
  });

  it("has no subcommand for options alone", () => {
    expect(splitGit(["--version"]).command).toBeUndefined();
  });
});

describe("gitApproval", () => {
  it.each([
    "status",
    "diff --stat",
    "log --oneline -5",
    "-C server pull --rebase",
    "fetch origin main",
    "clone git@github.com:a/b.git",
    "switch -c feat/x",
    "config --get user.name",
    "remote -v",
    "remote",
  ])("runs git %s", (line) => {
    expect(git(line)).toBeNull();
  });

  it("shows commits and pushes for review", () => {
    expect(git("commit -m fix")).toEqual({
      reason: "Commit",
      review: "commit",
    });
    expect(git("-C server push -u origin x")).toEqual({
      reason: "Push",
      review: "push",
    });
  });

  it.each([
    ["-c core.pager=evil log", "Changes how git runs"],
    ["rebase -x make main", "Changes how git runs"],
    ["grep -O vim foo", "Changes how git runs"],
    ["clone -u evil git@github.com:a/b", "Changes how git runs"],
    ["clone --config core.fsmonitor=x url", "Changes how git runs"],
    ["config core.sshCommand evil", "Changes how git runs"],
    ["remote set-url origin evil", "Changes how git runs"],
    ["submodule foreach make", "Runs git submodule"],
    ["--version", "Runs git"],
  ])("asks before git %s", (line, reason) => {
    expect(git(line)).toEqual({ reason });
  });

  it("asks for dangerous commands and paths outside the folder", () => {
    expect(git("reset --hard")?.reason).toMatch(/./);
    expect(git("-C ../other status")).toEqual({
      reason: "Outside the project: ~/other",
    });
    expect(git("clone url /tmp/x")).toEqual({
      reason: "Outside the project: /tmp/x",
    });
  });
});

describe("ghApproval", () => {
  it.each([
    "pr view 12 --comments",
    "pr list",
    "pr diff 3",
    "issue view 4",
    "api repos/a/b/pulls/1/comments",
    "api /repos/a/b/pulls/1/comments --paginate",
    "api -X GET repos/a/b",
    "api --method=get repos/a/b",
    "repo clone a/b",
  ])("runs gh %s", (line) => {
    expect(gh(line)).toBeNull();
  });

  it.each([
    "pr create --fill",
    "pr merge 3",
    "pr comment 3 -b hi",
    "api -X POST repos/a/b/issues",
    "api repos/a/b/issues -f title=x",
    "api graphql --input q.json",
    "extension-command",
  ])("asks before gh %s", (line) => {
    expect(gh(line)).toBe("Changes something on GitHub");
  });

  it("asks before cloning outside the folder", () => {
    expect(gh("repo clone a/b ../b")).toBe("Outside the project: ~/b");
  });
});

describe("taskRunsAlone", () => {
  const alone = (line: string, current: string | null = "feat/x") =>
    taskRunsAlone(line.split(" "), current, "dev");

  it("lets a commit run, even on a protected branch", () => {
    expect(alone("commit -m x")).toBe(true);
    expect(alone("commit -m x", null)).toBe(true);
    expect(alone("commit -m x", "main")).toBe(true);
  });

  it("lets a push of its own branch run", () => {
    expect(alone("push")).toBe(true);
    expect(alone("push -u origin")).toBe(true);
    expect(alone("push -u origin HEAD")).toBe(true);
    expect(alone("push origin feat/y")).toBe(true);
    expect(alone("push origin HEAD:feat/y")).toBe(true);
    expect(alone("-C sub push origin feat/y")).toBe(true);
  });

  it.each([
    "push origin main",
    "push origin master",
    "push origin dev",
    "push origin HEAD:main",
    "push origin feat/y:dev",
    "push -f origin feat/y",
    "push --force",
    "push --force-with-lease",
    "push --mirror",
    "push --all",
    "push --tags",
    "push -d origin feat/y",
    "push --delete origin feat/y",
    "push --prune",
    "push origin +feat/y",
    "status",
    "reset --hard",
  ])("asks for %s", (line) => {
    expect(alone(line)).toBe(false);
  });

  it("asks when the current branch is protected or unknown", () => {
    expect(alone("push", "main")).toBe(false);
    expect(alone("push", "dev")).toBe(false);
    expect(alone("push", null)).toBe(false);
    expect(alone("push origin HEAD", null)).toBe(false);
  });

  it("treats an unknown default branch as main and master only", () => {
    expect(taskRunsAlone(["push"], "dev", null)).toBe(true);
    expect(taskRunsAlone(["push"], "main", null)).toBe(false);
  });
});
