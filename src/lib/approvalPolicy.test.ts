import { describe, expect, it } from "vitest";
import {
  approvalFor,
  isInside,
  outsidePaths,
  resolvePath,
} from "./approvalPolicy";

const place = { cwd: "/Users/me/app", home: "/Users/me" };

describe("resolvePath", () => {
  it("resolves paths the way pi's tools do", () => {
    expect(resolvePath("src/a.ts", place)).toBe("/Users/me/app/src/a.ts");
    expect(resolvePath("./src/../b.ts", place)).toBe("/Users/me/app/b.ts");
    expect(resolvePath("@src/a.ts", place)).toBe("/Users/me/app/src/a.ts");
    expect(resolvePath("~/notes.md", place)).toBe("/Users/me/notes.md");
    expect(resolvePath("~", place)).toBe("/Users/me");
    expect(resolvePath("$HOME/x", place)).toBe("/Users/me/x");
    expect(resolvePath("${HOME}/x", place)).toBe("/Users/me/x");
    expect(resolvePath("/etc//hosts/", place)).toBe("/etc/hosts");
    expect(resolvePath("../other", place)).toBe("/Users/me/other");
    expect(resolvePath("/../../..", place)).toBe("/");
  });
});

describe("isInside", () => {
  it("counts the folder itself and what's under it", () => {
    expect(isInside("/Users/me/app", "/Users/me/app")).toBe(true);
    expect(isInside("/Users/me/app/src", "/Users/me/app")).toBe(true);
    expect(isInside("/Users/me/app/src", "/Users/me/app/")).toBe(true);
  });

  it("doesn't mistake a sibling with the same prefix for inside", () => {
    expect(isInside("/Users/me/app-old/x", "/Users/me/app")).toBe(false);
    expect(isInside("/Users/me", "/Users/me/app")).toBe(false);
  });
});

describe("outsidePaths", () => {
  it("finds absolute, home and parent paths outside the folder", () => {
    expect(outsidePaths("cat /etc/hosts", place)).toEqual(["/etc/hosts"]);
    expect(outsidePaths("ls ~/Downloads", place)).toEqual(["~/Downloads"]);
    expect(outsidePaths("cat $HOME/.npmrc", place)).toEqual(["$HOME/.npmrc"]);
    expect(outsidePaths("cp a.txt ../b.txt", place)).toEqual(["../b.txt"]);
    expect(outsidePaths("cat src/../../x", place)).toEqual(["src/../../x"]);
    expect(outsidePaths("tsc --outDir=/tmp/out", place)).toEqual(["/tmp/out"]);
    expect(outsidePaths("ls ~bob", place)).toEqual(["~bob"]);
    expect(outsidePaths('cat "/etc/passwd"', place)).toEqual(["/etc/passwd"]);
    expect(outsidePaths("echo x>/tmp/y", place)).toEqual(["/tmp/y"]);
  });

  it("ignores paths inside the folder, devices and plain words", () => {
    expect(outsidePaths("cat /Users/me/app/src/a.ts", place)).toEqual([]);
    expect(outsidePaths("npm test 2>/dev/null", place)).toEqual([]);
    expect(outsidePaths("echo hi > /dev/stderr", place)).toEqual([]);
    expect(outsidePaths("cat src/a.ts | grep x", place)).toEqual([]);
    expect(outsidePaths("cat src/../README.md", place)).toEqual([]);
    expect(outsidePaths("git log --oneline -5", place)).toEqual([]);
    expect(outsidePaths("curl https://example.com/a/b", place)).toEqual([]);
    expect(outsidePaths("sed s/../x/ file", place)).toEqual([]);
  });
});

describe("approvalFor", () => {
  it("asks for every call in Manual, without a reason", () => {
    expect(approvalFor("manual", "read", { path: "a.ts" }, place)).toEqual({});
    expect(approvalFor("manual", "bash", { command: "ls" }, place)).toEqual({});
    expect(approvalFor("manual", "mcp__github", {}, place)).toEqual({});
  });

  it("lets safe calls inside the folder run in Auto", () => {
    expect(approvalFor("auto", "read", { path: "src/a.ts" }, place)).toBeNull();
    expect(approvalFor("auto", "edit", { path: "./a.ts" }, place)).toBeNull();
    expect(
      approvalFor("auto", "write", { path: "/Users/me/app/b" }, place),
    ).toBeNull();
    expect(
      approvalFor("auto", "bash", { command: "npm test" }, place),
    ).toBeNull();
    expect(approvalFor("auto", "ls", {}, place)).toBeNull();
    expect(approvalFor("auto", "mcp", { tool: "search" }, place)).toBeNull();
  });

  it("stops dangerous commands in Auto, with the reason", () => {
    expect(
      approvalFor("auto", "bash", { command: "git reset --hard" }, place),
    ).toEqual({ reason: "Discards uncommitted changes (git reset --hard)" });
  });

  it("stops shell commands that reach outside the folder in Auto", () => {
    expect(
      approvalFor("auto", "bash", { command: "cat /etc/hosts" }, place),
    ).toEqual({ reason: "Outside the project: /etc/hosts" });
  });

  it("stops file tools outside the folder in Auto, naming the path", () => {
    expect(approvalFor("auto", "write", { path: "~/.zshrc" }, place)).toEqual({
      reason: "Outside the project: ~/.zshrc",
    });
    expect(approvalFor("auto", "read", { path: "../x" }, place)).toEqual({
      reason: "Outside the project: ~/x",
    });
    expect(approvalFor("auto", "grep", { path: "/etc" }, place)).toEqual({
      reason: "Outside the project: /etc",
    });
  });

  it("leaves paths to the sandbox when commands run in it, but not dangers", () => {
    const sandboxed = { sandboxed: true };
    const bash = (command: string) =>
      approvalFor("auto", "bash", { command }, place, sandboxed);
    expect(bash("cat /etc/hosts")).toBeNull();
    expect(bash("git push --force")).toEqual({
      reason: "Rewrites or deletes history on the remote",
    });
    // File tools don't run in the sandbox.
    expect(
      approvalFor("auto", "write", { path: "~/.zshrc" }, place, sandboxed),
    ).toEqual({ reason: "Outside the project: ~/.zshrc" });
  });

  it("ignores arguments of the wrong type", () => {
    expect(approvalFor("auto", "bash", { command: 1 }, place)).toBeNull();
    expect(approvalFor("auto", "read", { path: null }, place)).toBeNull();
  });
});
