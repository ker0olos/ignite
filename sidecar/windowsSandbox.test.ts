// @vitest-environment node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { NOTHING_ALLOWED } from "./sandboxAllow.ts";
import {
  bashLine,
  folderGrant,
  homeTools,
  windowsConfig,
} from "./windowsSandbox.ts";

const git = vi.hoisted(() => ({
  access: { allow: [] as string[], deny: [] as string[] },
}));
vi.mock("./worktreeGit.ts", () => ({ gitAccess: () => git.access }));

describe("homeTools", () => {
  it("keeps PATH folders under the home folder, whatever their case, once", () => {
    const path = [
      "C:\\Windows\\system32",
      "C:\\Users\\Me\\AppData\\Roaming\\nvm",
      "c:\\users\\me\\scoop\\shims",
      "C:\\Users\\Me\\AppData\\Roaming\\nvm",
      "C:\\Users\\Meg\\bin",
    ].join(";");
    expect(homeTools(path, "C:\\Users\\Me")).toEqual([
      "C:\\Users\\Me\\AppData\\Roaming\\nvm",
      "c:\\users\\me\\scoop\\shims",
    ]);
  });
});

describe("windowsConfig", () => {
  const allowed = {
    ...NOTHING_ALLOWED,
    hosts: ["api.example.com"],
    read: ["C:\\data"],
    write: ["C:\\out"],
  };
  const config = windowsConfig(
    "/home/me",
    allowed,
    ["C:\\Users\\Me\\nvm"],
    "C:\\Temp\\ignite-scratchpad",
    (path) => path.endsWith(".ssh"),
  );

  it("grants the scratchpads, per-user tools and what's always allowed", () => {
    expect(config.filesystem.allowWrite).toEqual([
      "C:\\Temp\\ignite-scratchpad",
      "C:\\out",
    ]);
    expect(config.filesystem.allowRead).toEqual([
      "C:\\Users\\Me\\nvm",
      "C:\\data",
    ]);
  });

  it("denies only credentials that exist, which srt-win would otherwise create", () => {
    expect(config.filesystem.denyRead).toEqual(["/home/me/.ssh"]);
  });

  it("keeps the network rules of the other platforms", () => {
    expect(config.network.allowedDomains).toContain("registry.npmjs.org");
    expect(config.network.allowedDomains).toContain("api.example.com");
    expect(config.network.tlsTerminate).toBeDefined();
  });
});

describe("folderGrant", () => {
  it("lets commands write in a folder outside any worktree", () => {
    git.access = { allow: [], deny: [] };
    expect(folderGrant("C:\\app")).toEqual({
      write: ["C:\\app"],
      read: [],
      denyWrite: [],
    });
  });

  it("adds a worktree's git files, reads its repository's, and keeps its pointers", () => {
    git.access = {
      allow: ["/repo/.git/worktrees/s1", "/repo/.git/objects"],
      deny: ["/wt/s1/.git", "/repo/.git/worktrees/s1/config.worktree"],
    };
    expect(folderGrant("/wt/s1", (p) => p.endsWith(".git"))).toEqual({
      write: ["/wt/s1", "/repo/.git/worktrees/s1", "/repo/.git/objects"],
      read: ["/repo/.git"],
      denyWrite: ["/wt/s1/.git"],
    });
  });
});

describe("bashLine", () => {
  it("passes every argument through bash as written", async () => {
    const args = ["%s|", "a b", "it's", "$HOME", "C:\\x", "--env", "A=/b"];
    const line = bashLine(["/usr/bin/printf", ...args]);
    const { stdout } = await promisify(execFile)("bash", ["-c", line]);
    expect(stdout).toBe("a b|it's|$HOME|C:\\x|--env|A=/b|");
  });

  it("turns off MSYS path conversion and gives the exe forward slashes", () => {
    expect(bashLine(["C:\\srt\\srt-win.exe", "exec"])).toBe(
      "MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' 'C:/srt/srt-win.exe' 'exec'",
    );
  });
});
