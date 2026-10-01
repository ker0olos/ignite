// @vitest-environment node
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TerminalMessage } from "../shared/terminal.ts";
import {
  closeTerminal,
  openTerminal,
  readTerminals,
  resizeTerminal,
  terminalSnapshot,
  terminalsIn,
  unseenTerminals,
  writeTerminal,
} from "./terminal.ts";

const cwd = realpathSync(mkdtempSync(join(tmpdir(), "terminal-")));
const opened: string[] = [];

// A bare shell, so the user's prompt and rc files don't slow or vary the test.
vi.stubEnv("SHELL", "/bin/sh");

function open(sent: TerminalMessage[] = []) {
  const info = openTerminal(cwd, 80, 24, (m) => sent.push(m));
  opened.push(info.terminal);
  return info.terminal;
}

const screen = (id: string) =>
  readTerminals("reader", cwd, 50, id).split("\n").slice(1).join("\n");

afterEach(() => {
  opened.splice(0).forEach(closeTerminal);
});

describe("terminal", () => {
  it("runs the user's command in the folder and sends its output", async () => {
    const sent: TerminalMessage[] = [];
    const id = open(sent);
    writeTerminal(id, "echo hi-$((1+2)) && pwd\r");
    await vi.waitFor(() => expect(screen(id)).toContain(`hi-3\n${cwd}`));
    expect(
      sent.map((m) => m.type === "terminal_data" && m.data).join(""),
    ).toContain("hi-3");
    expect(terminalsIn(cwd)).toEqual([{ terminal: id, cwd, running: true }]);
  });

  it("hands each conversation only what it hasn't seen, once", async () => {
    const id = open();
    writeTerminal(id, "echo first\r");
    await vi.waitFor(() => expect(screen(id)).toContain("\nfirst"));
    expect(unseenTerminals("a", cwd)).toContain("echo first\nfirst");
    expect(unseenTerminals("a", cwd)).toBeNull();
    writeTerminal(id, "echo second\r");
    await vi.waitFor(() => expect(screen(id)).toContain("\nsecond"));
    const next = unseenTerminals("a", cwd)!;
    expect(next).toContain("second");
    expect(next).not.toContain("first");
    expect(unseenTerminals("b", cwd)).toContain("first");
  });

  it("leaves out what full-screen programs draw on the alternate screen", async () => {
    const sent: TerminalMessage[] = [];
    const id = open(sent);
    writeTerminal(id, "echo shell\r");
    await vi.waitFor(() => expect(screen(id)).toContain("\nshell"));
    unseenTerminals("a", cwd);
    writeTerminal(id, "printf '\\033[?1049hredraw\\nredraw\\n'\r");
    await vi.waitFor(() =>
      expect(JSON.stringify(sent)).toContain("redraw\\r\\nredraw"),
    );
    await new Promise((r) => setTimeout(r, 100));
    // The command that opened it, not what it drew.
    const unseen = unseenTerminals("a", cwd)!;
    expect(unseen).toContain("printf");
    expect(unseen).not.toContain("redraw\nredraw");
    expect(unseenTerminals("a", cwd)).toBeNull();
    expect(screen(id)).not.toContain("redraw\nredraw");
  });

  it("reports the shell's exit and stops taking input", async () => {
    const sent: TerminalMessage[] = [];
    const id = open(sent);
    writeTerminal(id, "exit 3\r");
    await vi.waitFor(() =>
      expect(sent).toContainEqual({
        type: "terminal_exit",
        terminal: id,
        exitCode: 3,
      }),
    );
    expect(() => writeTerminal(id, "echo late\r")).not.toThrow();
    expect(readTerminals("reader", cwd, 10, id)).toContain("(exited 3)");
    expect(await terminalSnapshot(id)).toMatchObject({ exitCode: 3 });
  });

  it("snapshots everything it has sent, parsed or not", async () => {
    const sent: TerminalMessage[] = [];
    const id = open(sent);
    writeTerminal(id, "echo marker-$((40+2))\r");
    await vi.waitFor(() =>
      expect(JSON.stringify(sent)).toContain("marker-42\\r\\n"),
    );
    const { screen, exitCode } = await terminalSnapshot(id);
    expect(screen).toContain("marker-42");
    expect(exitCode).toBeUndefined();
  });

  it("resizes, snapshots, and forgets a closed terminal", async () => {
    const id = open();
    resizeTerminal(id, 100, 30);
    writeTerminal(id, "printf '\\033[31mred\\033[0m\\n'\r");
    await vi.waitFor(async () =>
      expect((await terminalSnapshot(id)).screen).toContain("\x1b[31mred"),
    );
    closeTerminal(id);
    expect(terminalsIn(cwd)).toEqual([]);
    await expect(terminalSnapshot(id)).rejects.toThrow(`No terminal ${id}.`);
    expect(readTerminals("reader", cwd, 10)).toBe(
      `The user has no terminal open in ${cwd}.`,
    );
    expect(readTerminals("reader", cwd, 10, "t0")).toBe(
      `No terminal t0 in ${cwd}.`,
    );
  });
});
