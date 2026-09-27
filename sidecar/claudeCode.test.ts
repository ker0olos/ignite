// @vitest-environment node
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClaudeCode } from "./claudeCode.ts";

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
