import { describe, expect, it } from "vitest";
import {
  WINDOWS_SHELL,
  approvalFor,
  isInside,
  outsidePaths,
  resolvePath,
} from "./approvalPolicy";

const place = { cwd: "/Users/me/app", home: "/Users/me" };

describe("on Windows", () => {
  const win = {
    cwd: "C:\\Users\\Me\\app",
    home: "C:\\Users\\Me",
    windows: true,
  };
  const file = (path: string) => approvalFor("auto", "read", { path }, win);

  it("resolves drive letters, backslashes and case like Windows", () => {
    expect(resolvePath("src\\a.ts", win)).toBe("c:/users/me/app/src/a.ts");
    expect(resolvePath("C:\\Users\\ME\\APP\\b.ts", win)).toBe(
      "c:/users/me/app/b.ts",
    );
    expect(resolvePath("..\\x", win)).toBe("c:/users/me/x");
    expect(resolvePath("~\\.ssh\\id_rsa", win)).toBe("c:/users/me/.ssh/id_rsa");
    expect(resolvePath("\\Windows\\hosts", win)).toBe("c:/windows/hosts");
    expect(resolvePath("D:notes.txt", win)).toBe("d:/notes.txt");
    expect(resolvePath("@src/a.ts", win)).toBe("c:/users/me/app/src/a.ts");
  });

  it("lets file tools inside the folder run, however the path is written", () => {
    expect(file("src\\a.ts")).toBeNull();
    expect(file("c:\\users\\me\\APP\\src\\a.ts")).toBeNull();
    expect(file("C:/Users/Me/app/README.md")).toBeNull();
  });

  it("asks for file tools outside the folder", () => {
    expect(file("C:\\Users\\Me\\.ssh\\id_rsa")).toEqual({
      reason: "Outside the folder: ~/.ssh/id_rsa",
    });
    expect(file("D:\\secrets.txt")).toEqual({
      reason: "Outside the folder: d:/secrets.txt",
    });
    expect(file("..\\app-old\\x")).not.toBeNull();
    expect(file("\\\\server\\share\\x")).not.toBeNull();
  });

  it("asks for every shell command, naming a danger when there is one", () => {
    const shell = (toolName: string, command: string) =>
      approvalFor("auto", toolName, { command }, win, { sandboxed: true });
    expect(shell("bash", "npm test")).toEqual({ reason: WINDOWS_SHELL });
    expect(shell("powershell", "Get-ChildItem")).toEqual({
      reason: WINDOWS_SHELL,
    });
    expect(shell("bash", "git push --force")).toEqual({
      reason: "Rewrites or deletes history on the remote",
    });
  });

  it("leaves other tools to Auto as elsewhere", () => {
    expect(approvalFor("auto", "mcp", { tool: "search" }, win)).toBeNull();
  });
});

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

  it("lets every call run with full access", () => {
    expect(
      approvalFor("full", "read", { path: "~/.ssh/config" }, place),
    ).toBeNull();
    expect(
      approvalFor("full", "bash", { command: "git push --force" }, place),
    ).toBeNull();
    expect(approvalFor("full", "mcp__github", {}, place)).toBeNull();
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

  it("asks before MCP calls that may change something in Auto", () => {
    const call = (tool: string) =>
      approvalFor("auto", "mcp__clickup", { tool }, place);
    expect(call("clickup_get_list")).toBeNull();
    expect(call("clickup_create_comment")).toEqual({
      reason: "May make changes: clickup_create_comment",
    });
    expect(call("updateTaskStatus")).not.toBeNull();
    expect(call("clickup_get_or_create_task")).not.toBeNull();
    expect(call("do_something")).not.toBeNull();
    expect(call("mysql_query")).not.toBeNull();
    expect(call("search_replace")).not.toBeNull();
    expect(
      approvalFor("auto", "clickup_get_task", {}, place, { mcpDirect: true }),
    ).toBeNull();
    expect(
      approvalFor("auto", "clickup_delete_task", {}, place, {
        mcpDirect: true,
      }),
    ).toEqual({ reason: "May make changes: clickup_delete_task" });
    expect(approvalFor("auto", "mcp", { tool: "x_delete" }, place)).toEqual({
      reason: "May make changes: x_delete",
    });
    expect(approvalFor("auto", "mcpScript", { code: "" }, place)).toEqual({
      reason: "Runs MCP calls from a script",
    });
    expect(approvalFor("auto", "mcp", { search: "status" }, place)).toBeNull();
    expect(approvalFor("auto", "mcp__clickup", {}, place)).toBeNull();
  });

  it("stops dangerous commands in Auto, with the reason", () => {
    expect(
      approvalFor("auto", "bash", { command: "git reset --hard" }, place),
    ).toEqual({ reason: "Discards uncommitted changes (git reset --hard)" });
  });

  it("stops shell commands that reach outside the folder in Auto", () => {
    expect(
      approvalFor("auto", "bash", { command: "cat /etc/hosts" }, place),
    ).toEqual({ reason: "Outside the folder: /etc/hosts" });
  });

  it("stops file tools outside the folder in Auto, naming the path", () => {
    expect(approvalFor("auto", "write", { path: "~/.zshrc" }, place)).toEqual({
      reason: "Outside the folder: ~/.zshrc",
    });
    expect(approvalFor("auto", "read", { path: "../x" }, place)).toEqual({
      reason: "Outside the folder: ~/x",
    });
    expect(approvalFor("auto", "grep", { path: "/etc" }, place)).toEqual({
      reason: "Outside the folder: /etc",
    });
  });

  it("lets file tools use temp folders in Auto, like sandboxed bash", () => {
    const withTemp = { ...place, temp: ["/private/tmp"] };
    expect(
      approvalFor("auto", "read", { path: "/private/tmp/p.png" }, withTemp),
    ).toBeNull();
    expect(
      approvalFor("auto", "read", { path: "/private/tmpx/p" }, withTemp),
    ).toEqual({ reason: "Outside the folder: /private/tmpx/p" });
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
    ).toEqual({ reason: "Outside the folder: ~/.zshrc" });
  });

  it("ignores arguments of the wrong type", () => {
    expect(approvalFor("auto", "bash", { command: 1 }, place)).toBeNull();
    expect(approvalFor("auto", "read", { path: null }, place)).toBeNull();
  });
});

describe("adb under Auto", () => {
  const adb = (...args: string[]) =>
    approvalFor("auto", "adb", { args }, place);

  it("runs device-only calls and transfers inside the folder", () => {
    expect(adb("shell", "input", "tap", "1", "2")).toBeNull();
    expect(adb("push", "build/app.txt", "/sdcard/")).toBeNull();
    expect(adb("pull", "/sdcard/shot.png")).toBeNull();
    expect(adb("-s", "emu", "install", "-r", "app.apk")).toBeNull();
  });

  it("asks for host paths outside the folder", () => {
    expect(adb("push", "~/.ssh/id_ed25519", "/sdcard/")).toEqual({
      reason: "Outside the folder: ~/.ssh/id_ed25519",
    });
    expect(adb("pull", "/sdcard/x", "/Users/me/.zshrc")).toEqual({
      reason: "Outside the folder: ~/.zshrc",
    });
    expect(adb("-s", "emu", "install", "../other.apk")).toEqual({
      reason: "Outside the folder: ~/other.apk",
    });
  });
});
