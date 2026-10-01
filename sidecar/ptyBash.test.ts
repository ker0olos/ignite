// @vitest-environment node
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { startShell } from "./ptyBash.ts";

vi.stubEnv("SHELL", "/bin/sh");

async function run(command: string) {
  let text = "";
  let raw = "";
  const { done } = startShell(
    command,
    tmpdir(),
    process.env,
    (t) => (text += t),
    (r) => (raw += r),
  );
  const { exitCode } = await done;
  return { exitCode, text, raw };
}

describe.runIf(process.platform !== "win32")("startShell", () => {
  it("runs in a terminal: raw output colored, text as the screen ends up", async () => {
    const { exitCode, text, raw } = await run(
      "[ -t 1 ] && printf '\\033[32mok\\033[0m\\n'; printf 'spin 1\\rspin 2\\rdone  \\n'; exit 3",
    );
    expect(exitCode).toBe(3);
    expect(text).toBe("ok\ndone\n");
    expect(raw).toContain("\x1b[32mok");
  });

  it("keeps a last line without a newline", async () => {
    expect((await run("printf 'no newline'")).text).toBe("no newline");
  });

  it("gives prompts no input and pages to cat, so nothing waits", async () => {
    const { text, exitCode } = await run(
      "read answer || echo no-input; printf 'a\\nb\\n' | ${PAGER:-less}",
    );
    expect(exitCode).toBe(0);
    expect(text).toBe("no-input\na\nb\n");
  });

  it("reports a signal as a shell does", async () => {
    expect((await run("kill -TERM $$")).exitCode).toBe(143);
  });
});
