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
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALLOWED_DOMAINS,
  blockedAction,
  blockedProgram,
  blockedSummary,
  canAllow,
  createSandbox,
  explainWhenReported,
  mayBeBlocked,
  refusedLine,
  sandboxConfig,
  type Sandbox,
} from "./sandbox.ts";
import { startShell } from "./ptyBash.ts";
import { allowAlways, allowedFile, type AllowRule } from "./sandboxAllow.ts";
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

  it("adds what the user always allows", () => {
    const allowed = sandboxConfig("/Users/me/app", "/Users/me", {
      hosts: ["example.com"],
      sockets: ["/Users/me/.docker/run/docker.sock"],
      read: ["/Users/me/.docker/config.json"],
      write: ["/Users/me/.zshrc"],
      commands: [],
    });
    expect(allowed.network.allowedDomains).toContain("example.com");
    expect(allowed.network.allowUnixSockets).toEqual([
      "/Users/me/.docker/run/docker.sock",
    ]);
    expect(allowed.filesystem.allowRead).toEqual([
      "/Users/me/.docker/config.json",
    ]);
    expect(allowed.filesystem.allowWrite).toContain("/Users/me/.zshrc");
  });
});

describe("canAllow", () => {
  it("never offers credentials, nor what's already allowed", async () => {
    const home = await mkdtemp(join(tmpdir(), "can-allow-"));
    try {
      const key = { kind: "read", target: join(home, ".ssh/id_ed25519") };
      expect(await canAllow(key as AllowRule, home)).toBe(false);
      const docker = join(home, ".docker/config.json");
      expect(await canAllow({ kind: "read", target: docker }, home)).toBe(
        false,
      );
      const sock = { kind: "sockets", target: join(home, "x.sock") } as const;
      expect(await canAllow(sock, home)).toBe(true);
      await allowAlways(sock, allowedFile(home));
      expect(await canAllow(sock, home)).toBe(false);
      const run = (target: string) => ({ kind: "commands", target }) as const;
      expect(await canAllow(run("doppler"), home)).toBe(true);
      for (const program of ["bash", "python3.12", "npm", "cat", "security"]) {
        expect(await canAllow(run(program), home)).toBe(false);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("blockedProgram", () => {
  it("names the program behind the first file or network denial", () => {
    const output =
      "<sandbox_violations>\nsh(1) deny(1) system-info x\n" +
      "doppler(42) deny(1) file-read-data /Users/me/Library/Keychains/login.keychain-db\n" +
      "</sandbox_violations>";
    expect(blockedProgram(output)).toBe("doppler");
  });

  it("is null without a report naming one", () => {
    expect(blockedProgram("Operation not permitted")).toBeNull();
    expect(
      blockedProgram(
        "<sandbox_violations>\ndeny network-outbound x:443\n</sandbox_violations>",
      ),
    ).toBeNull();
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

  it("reads the network proxy's format too", () => {
    expect(
      blockedSummary(
        "<sandbox_violations>\ndeny network-outbound example.com:443 (host is not on the allow list)\n</sandbox_violations>",
      ),
    ).toBe("network-outbound example.com:443 (host is not on the allow list)");
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

  it("matches Go tools' lowercase message", () => {
    expect(
      refusedLine("open ~/.docker/config.json: operation not permitted"),
    ).toBe("open ~/.docker/config.json: operation not permitted");
  });

  it("is null for other failures", () => {
    expect(refusedLine("npm ERR! code E404")).toBeNull();
  });
});

describe("mayBeBlocked", () => {
  it("spots a refusal in a successful command's output", () => {
    expect(mayBeBlocked("dial unix x.sock: connect: permission denied")).toBe(
      true,
    );
    expect(mayBeBlocked("touch: x: Operation not permitted")).toBe(true);
    expect(mayBeBlocked("200 OK")).toBe(false);
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

  it("fails a pipeline when any command in it fails", async () => {
    expect((await run("false | cat", "pipefail")).ok).toBe(false);
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

  it("lets through the sockets and paths the user always allows", async () => {
    const sock = join(home, "s.sock");
    const server = createServer((c) =>
      c.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"),
    );
    await new Promise<void>((resolve) => server.listen(sock, resolve));
    try {
      const curl = `curl -sS --unix-socket ${sock} http://x/`;
      expect((await run(curl, "sock-blocked")).ok).toBe(false);
      await allowAlways({ kind: "sockets", target: sock }, allowedFile(home));
      expect(await run(curl, "sock-allowed")).toEqual({ ok: true, out: "ok" });
    } finally {
      server.close();
    }
    await allowAlways({ kind: "write", target: escape }, allowedFile(home));
    expect((await run(`touch ${escape}`, "write-allowed")).ok).toBe(true);
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

  // Local services (the user's Chrome over CDP, the remote access server) stay out of reach.
  it("blocks listening on a port and reaching local services", async () => {
    const local = createServer((c) =>
      c.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"),
    );
    await new Promise<void>((resolve) => local.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = local.address() as { port: number };
      const curl = `curl -sS --max-time 5 http://127.0.0.1:${port}/`;
      expect((await run(curl, "reach-local")).ok).toBe(false);
      const listen = `node -e "require('net').createServer().listen(0, '127.0.0.1', () => process.exit(0))"`;
      expect((await run(listen, "listen")).ok).toBe(false);
    } finally {
      local.close();
    }
  }, 20_000);

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

  it("runs a background command's terminal as it would outside", async () => {
    const wrapped = await sandbox.wrap(
      "[ -t 1 ] && echo tty; node -p process.stdout.columns",
      cwd,
      "pty",
    );
    let output = "";
    const { done } = startShell(
      wrapped,
      cwd,
      process.env,
      (t) => (output += t),
    );
    expect({ exitCode: (await done).exitCode, output }).toEqual({
      exitCode: 0,
      output: "tty\n120\n",
    });
  });
});
