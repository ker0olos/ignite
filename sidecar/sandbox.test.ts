// @vitest-environment node
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALLOWED_DOMAINS,
  blockedAction,
  blockedSummary,
  createSandbox,
  explainWhenReported,
  refusedLine,
  sandboxConfig,
  type Sandbox,
} from "./sandbox.ts";
import { createWorkspaces } from "./worktrees.ts";

describe("sandboxConfig", () => {
  const config = sandboxConfig("/Users/me/app", "/Users/me");

  it("lets commands write in the folder, temp and package caches only", () => {
    const writable = config.filesystem.allowWrite;
    expect(writable).toContain("/Users/me/app");
    expect(writable).toContain(tmpdir());
    expect(writable).toContain("/Users/me/.npm");
    expect(writable).not.toContain("/Users/me");
  });

  it("hides credentials", () => {
    expect(config.filesystem.denyRead).toEqual(
      expect.arrayContaining([
        "/Users/me/.ssh",
        "/Users/me/.aws",
        "/Users/me/Library/Keychains",
        "/Users/me/.ignite/pi/auth.json",
      ]),
    );
  });

  it("reaches only package registries and git hosts", () => {
    expect(config.network.allowedDomains).toEqual(ALLOWED_DOMAINS);
    expect(ALLOWED_DOMAINS).toContain("registry.npmjs.org");
    expect(ALLOWED_DOMAINS).toContain("github.com");
  });
});

describe("blockedSummary", () => {
  it("names the first thing the sandbox blocked", () => {
    const output =
      "touch: x: Operation not permitted\n\n<sandbox_violations>\n" +
      "touch(123) deny(1) file-write-create /Users/me/x\n" +
      "touch(123) deny(1) file-write-data /Users/me/x\n</sandbox_violations>";
    expect(blockedSummary(output)).toBe("file-write-create /Users/me/x");
  });

  it("prefers the file or network denial over lookups logged on the way", () => {
    const output =
      "<sandbox_violations>\ncurl(9) deny(1) system-info vfs.disk-space\n" +
      "curl(9) deny(1) network-outbound example.com:443\n</sandbox_violations>";
    expect(blockedSummary(output)).toBe("network-outbound example.com:443");
  });

  it("is null when only lookups were denied, as for a grep with no match", () => {
    expect(
      blockedSummary(
        "<sandbox_violations>\ngrep(1) deny(1) system-info vfs.disk-space\n" +
          "x(1) deny(1) mach-lookup com.apple.x\n</sandbox_violations>",
      ),
    ).toBeNull();
  });

  it("keeps a line in another format as is", () => {
    expect(
      blockedSummary(
        "<sandbox_violations>\ndeny network-outbound example.com:443\n</sandbox_violations>",
      ),
    ).toBe("deny network-outbound example.com:443");
  });

  it("is null without a report", () => {
    expect(blockedSummary("npm ERR! something else")).toBeNull();
    expect(
      blockedSummary("<sandbox_violations>\n</sandbox_violations>"),
    ).toBeNull();
  });
});

describe("blockedAction", () => {
  it.each([
    ["file-read-data /Users/me/.ssh/config", "read ~/.ssh/config"],
    ["file-write-create /tmp/x", "create /tmp/x"],
    ["file-write-unlink /Users/me/x", "delete ~/x"],
    ["file-write-data /Users/me/x", "write to ~/x"],
    ["network-outbound example.com:443", "connect to example.com:443"],
  ])("says %s in plain words", (summary, plain) => {
    expect(blockedAction(summary, "/Users/me")).toBe(plain);
  });

  it("is null for what it can't phrase", () => {
    expect(blockedAction("mach-lookup com.apple.x", "/Users/me")).toBeNull();
    expect(
      blockedAction("touch: x: Operation not permitted", "/Users/me"),
    ).toBeNull();
  });
});

describe("refusedLine", () => {
  it("finds where the command says the OS refused it", () => {
    expect(
      refusedLine("a\ntouch: /Users/me/x: Operation not permitted\nb"),
    ).toBe("touch: /Users/me/x: Operation not permitted");
  });

  it("is null for other failures", () => {
    expect(refusedLine("npm ERR! code E404")).toBeNull();
  });
});

describe("explainWhenReported", () => {
  it("waits for a report that arrives late", async () => {
    let calls = 0;
    const annotate = (out: string) => (++calls < 3 ? out : `${out} [report]`);
    expect(await explainWhenReported(annotate, "failed", { delay: 1 })).toBe(
      "failed [report]",
    );
    expect(calls).toBe(3);
  });

  it("gives up after its tries, returning the output as is", async () => {
    let calls = 0;
    const annotate = (out: string) => (calls++, out);
    expect(
      await explainWhenReported(annotate, "failed", { tries: 4, delay: 1 }),
    ).toBe("failed");
    expect(calls).toBe(4);
  });
});

// The real sandbox, on the platform CI and the app run on.
describe.runIf(process.platform === "darwin")("createSandbox on macOS", () => {
  const sh = promisify(exec);
  let sandbox: Sandbox;
  let home: string;
  let cwd: string;
  const escape = join(homedir(), `.ignite-sandbox-test-${process.pid}`);

  beforeAll(async () => {
    home = await realpath(await mkdtemp(join(tmpdir(), "sandbox-home-")));
    cwd = join(home, "app");
    await mkdir(join(home, ".ssh"), { recursive: true });
    await mkdir(cwd);
    await writeFile(join(home, ".ssh", "id_test"), "secret");
    sandbox = (await createSandbox(home))!;
  });
  afterAll(async () => {
    await rm(home, { recursive: true, force: true });
    await rm(escape, { force: true });
  });

  /** Runs a command in the sandbox; its output, explained on failure. */
  const run = async (command: string, id: string, dir = cwd) => {
    const wrapped = await sandbox.wrap(command, dir, id);
    try {
      return { ok: true, out: (await sh(wrapped, { cwd: dir })).stdout };
    } catch (error) {
      const stderr = (error as { stderr: string }).stderr;
      return { ok: false, out: await sandbox.explain(id, stderr) };
    }
  };

  it("runs commands that stay in the folder", async () => {
    const { ok } = await run("echo hi > note.txt && cat note.txt", "ok");
    expect(ok).toBe(true);
    expect(existsSync(join(cwd, "note.txt"))).toBe(true);
  });

  it("blocks writes outside, however the path is spelled", async () => {
    const { ok, out } = await run(`P=${escape}; touch "$P"`, "write");
    expect(ok).toBe(false);
    expect(existsSync(escape)).toBe(false);
    // Under load macOS can report it after explain() stops waiting; the
    // refusal in the output is what the extension falls back to then.
    expect(blockedSummary(out) ?? refusedLine(out)).toMatch(
      /file-write|Operation not permitted/,
    );
  });

  it("lets git work in an agent's worktree, but not repoint it", async () => {
    const repo = join(home, "repo");
    await mkdir(repo);
    await sh(
      "git init -q -b main && git -c user.name=t -c user.email=t@t commit -q --allow-empty -m init",
      { cwd: repo },
    );
    const workspaces = createWorkspaces();
    const id = `sandbox-test-${process.pid}`;
    const { dir } = await workspaces.open(repo, id);
    try {
      await writeFile(join(dir, "made.ts"), "x");
      expect((await run("git add made.ts", "git-add", dir)).ok).toBe(true);
      const own = join(repo, ".git", "worktrees", id);
      for (const file of [join(dir, ".git"), join(own, "commondir")]) {
        const before = await readFile(file, "utf8");
        const { ok } = await run(
          `echo gitdir: /tmp > "${file}"`,
          "repoint",
          dir,
        );
        expect(ok).toBe(false);
        expect(await readFile(file, "utf8")).toBe(before);
      }
    } finally {
      await workspaces.close(repo, id);
    }
  }, 30_000);

  it("blocks reading credentials", async () => {
    const { ok, out } = await run(`cat ${home}/.ssh/id_test`, "read");
    expect(ok).toBe(false);
    expect(out).not.toContain("secret");
  });

  it("blocks hosts that aren't allowed", async () => {
    const { ok, out } = await run(
      "curl -sS --max-time 10 https://example.com",
      "net",
    );
    expect(ok).toBe(false);
    expect(blockedSummary(out)).toContain("example.com");
  }, 20_000);
});
