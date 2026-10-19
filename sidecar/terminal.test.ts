// @vitest-environment node
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TerminalMessage } from "../shared/terminal.ts";
import {
  closeIdleTerminal,
  closeTerminal,
  endTerminal,
  openTerminal,
  readTerminals,
  resizeTerminal,
  terminalSnapshot,
  terminalsIn,
  terminalsStartedIn,
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
    expect(terminalsIn(cwd)).toEqual([
      { terminal: id, name: "t1", cwd, running: true },
    ]);
  });

  it("starts in a conversation's worktree, listed under its folder", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
    const info = openTerminal(cwd, 80, 24, () => {}, dir);
    opened.push(info.terminal);
    expect(terminalsIn(cwd)).toEqual([
      { terminal: info.terminal, name: "t1", cwd, dir, running: true },
    ]);
    writeTerminal(info.terminal, "pwd\r");
    await vi.waitFor(() => expect(screen(info.terminal)).toContain(`\n${dir}`));
    expect(readTerminals("reader", cwd, 50, "t1")).toMatch(
      new RegExp(`^Terminal t1 in ${dir}`),
    );
  });

  it("ends a worktree's terminals, telling the app, and starts in the folder once it's gone", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
    const sent: TerminalMessage[] = [];
    const inside = openTerminal(cwd, 80, 24, (m) => sent.push(m), dir);
    const other = open();
    opened.push(inside.terminal);
    expect(terminalsStartedIn(dir)).toEqual([inside.terminal]);
    await endTerminal(inside.terminal);
    expect(terminalsIn(cwd).map((t) => t.terminal)).toEqual([other]);
    expect(sent).toContainEqual({
      type: "terminal_exit",
      terminal: inside.terminal,
      exitCode: -1,
    });
    const gone = openTerminal(cwd, 80, 24, () => {}, join(dir, "removed"));
    opened.push(gone.terminal);
    expect(gone.dir).toBeUndefined();
  });

  it("tells the app when it ends a terminal that had exited, with its own code", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
    const sent: TerminalMessage[] = [];
    const t = openTerminal(cwd, 80, 24, (m) => sent.push(m), dir);
    opened.push(t.terminal);
    writeTerminal(t.terminal, "exit 3\r");
    await vi.waitFor(() =>
      expect(
        terminalsIn(cwd).find((i) => i.terminal === t.terminal)?.running,
      ).toBe(false),
    );
    sent.length = 0;
    await endTerminal(t.terminal);
    expect(sent).toEqual([
      { type: "terminal_exit", terminal: t.terminal, exitCode: 3 },
    ]);
  });

  it("names the folder's terminals by their place, so closing one renames the rest", async () => {
    const [first, second] = [open(), open()];
    expect(terminalsIn(cwd).map((t) => t.name)).toEqual(["t1", "t2"]);
    writeTerminal(second, "echo from-second\r");
    await vi.waitFor(() => expect(screen("t2")).toContain("\nfrom-second"));
    closeTerminal(first);
    expect(terminalsIn(cwd)).toMatchObject([{ terminal: second, name: "t1" }]);
    // The agent reads it by its new name; its header says so.
    const read = readTerminals("reader", cwd, 50, "t1");
    expect(read).toMatch(/^Terminal t1 in /);
    expect(read).toContain("from-second");
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

  it.skipIf(process.platform === "win32")(
    "names the command running in it, until the prompt is back",
    async () => {
      const sent: TerminalMessage[] = [];
      const id = open(sent);
      const commands = () =>
        sent.flatMap((m) => (m.type === "terminal_command" ? [m] : []));
      writeTerminal(id, "sleep 1.5\r");
      await vi.waitFor(() =>
        expect(commands()).toEqual([
          { type: "terminal_command", terminal: id, command: "sleep 1.5" },
        ]),
      );
      expect(terminalsIn(cwd)[0]?.command).toBe("sleep 1.5");
      await vi.waitFor(
        () => expect(commands().at(-1)?.command).toBeUndefined(),
        { timeout: 4000 },
      );
      expect(commands()).toHaveLength(2);
    },
  );

  it.skipIf(process.platform === "win32")(
    "closes when idle, not while a command runs",
    async () => {
      const id = open();
      writeTerminal(id, "sleep 5\r");
      await vi.waitFor(() =>
        expect(terminalsIn(cwd)[0]?.command).toBe("sleep 5"),
      );
      expect(await closeIdleTerminal(id)).toBe(false);
      expect(terminalsIn(cwd)).toHaveLength(1);
      writeTerminal(id, "\x03");
      await vi.waitFor(async () =>
        expect(await closeIdleTerminal(id)).toBe(true),
      );
      expect(terminalsIn(cwd)).toEqual([]);
      expect(await closeIdleTerminal(id)).toBe(true);
    },
  );

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
