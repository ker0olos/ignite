// @vitest-environment node
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bridgeToClaude,
  claudeExecutable,
  createClaudeCode,
} from "./claudeCode.ts";

// Each test stands in for `claude` with a small shell script.
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "claude-code-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

async function fakeClaude(script: string) {
  const path = join(dir, "claude");
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return createClaudeCode(path);
}

describe("status", () => {
  it("reports Claude Code missing", async () => {
    const claude = createClaudeCode(join(dir, "missing"));
    expect(await claude.status()).toEqual({
      installed: false,
      loggedIn: false,
    });
  });

  it("reads whether Claude Code is signed in", async () => {
    const signedIn = await fakeClaude(`echo '{"loggedIn": true}'`);
    expect(await signedIn.status()).toEqual({
      installed: true,
      loggedIn: true,
    });
    const signedOut = await fakeClaude(`echo '{"loggedIn": false}'; exit 1`);
    expect(await signedOut.status()).toEqual({
      installed: true,
      loggedIn: false,
    });
  });

  it("gives up on a claude that hangs, as signed out", async () => {
    const path = join(dir, "claude");
    await writeFile(path, "#!/bin/sh\nsleep 5\n");
    await chmod(path, 0o755);
    const claude = createClaudeCode(path, 200);
    expect(await claude.status()).toEqual({ installed: true, loggedIn: false });
  });

  it("doesn't hang on a claude that reads its input first", async () => {
    const path = join(dir, "claude");
    await writeFile(
      path,
      `#!/bin/sh\ncat >/dev/null\necho '{"loggedIn": true}'\n`,
    );
    await chmod(path, 0o755);
    const claude = createClaudeCode(path, 2000);
    expect(await claude.status()).toEqual({ installed: true, loggedIn: true });
  });

  it("treats output it can't read as signed out", async () => {
    const claude = await fakeClaude(`echo "Not logged in"`);
    expect(await claude.status()).toEqual({ installed: true, loggedIn: false });
  });
});

describe("login", () => {
  it("passes on the sign-in page once and resolves when it succeeds", async () => {
    const claude = await fakeClaude(
      `echo "Opening https://claude.ai/oauth?x=1"; echo "again https://claude.ai/other" >&2`,
    );
    const urls: string[] = [];
    await claude.login(new AbortController().signal, (u) => urls.push(u));
    expect(urls).toEqual(["https://claude.ai/oauth?x=1"]);
  });

  it("fails when Claude Code's sign-in fails", async () => {
    const claude = await fakeClaude("exit 3");
    await expect(
      claude.login(new AbortController().signal, () => {}),
    ).rejects.toThrow("Claude Code sign-in failed (exit code 3).");
  });

  it("stops when cancelled", async () => {
    const claude = await fakeClaude("sleep 5");
    const controller = new AbortController();
    const done = claude.login(controller.signal, () => {});
    controller.abort();
    await expect(done).rejects.toThrow();
  });
});

describe("claudeExecutable", () => {
  const home = () => join(dir, "home");
  const file = async (...parts: string[]) => {
    await mkdir(join(...parts, ".."), { recursive: true });
    await writeFile(join(...parts), "");
    return join(...parts);
  };

  it("is the first claude on PATH, claude.exe on Windows", async () => {
    const [a, b] = [join(dir, "a"), join(dir, "b")];
    await mkdir(join(a, "claude"), { recursive: true }); // a folder, not it
    const unix = await file(b, "claude");
    const windows = await file(b, "claude.exe");
    expect(claudeExecutable(`:${a}:${b}`, "darwin", home(), {})).toBe(unix);
    expect(claudeExecutable(`${a};${b}`, "win32", home(), {})).toBe(windows);
  });

  it("finds the binary behind npm's claude.cmd on Windows", async () => {
    const npm = join(dir, "npm");
    await file(npm, "claude.cmd");
    const binary = await file(
      npm,
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    );
    expect(claudeExecutable(npm, "win32", home(), {})).toBe(binary);
  });

  it("looks where the installers put it when PATH has none", async () => {
    const native = await file(home(), ".local", "bin", "claude");
    expect(claudeExecutable("", "linux", home(), {})).toBe(native);
    const winget = await file(
      dir,
      "local",
      "Microsoft",
      "WinGet",
      "Links",
      "claude.exe",
    );
    expect(
      claudeExecutable("", "win32", home(), {
        LOCALAPPDATA: join(dir, "local"),
      }),
    ).toBe(winget);
  });

  it("is null when Claude Code isn't installed", () => {
    expect(
      claudeExecutable("", "win32", home(), { ProgramData: dir }),
    ).toBeNull();
  });
});

describe("bridgeToClaude", () => {
  const config = () => join(dir, "pi", "claude-bridge.json");

  it("sets the bridge's Claude Code, keeping its other settings", async () => {
    await mkdir(join(dir, "pi"));
    await writeFile(
      config(),
      JSON.stringify({ provider: { plan: "max" }, askClaude: {} }),
    );
    await bridgeToClaude(join(dir, "pi"), "/bin/claude");
    expect(JSON.parse(await readFile(config(), "utf8"))).toEqual({
      provider: { plan: "max", pathToClaudeCodeExecutable: "/bin/claude" },
      askClaude: {},
    });
  });

  it("writes nothing without a Claude Code, or over a file that doesn't parse", async () => {
    await bridgeToClaude(join(dir, "pi"), null);
    await expect(readFile(config(), "utf8")).rejects.toThrow();
    await mkdir(join(dir, "pi"));
    await writeFile(config(), "{ oops");
    await bridgeToClaude(join(dir, "pi"), "/bin/claude");
    expect(await readFile(config(), "utf8")).toBe("{ oops");
  });
});
