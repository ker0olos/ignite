// @vitest-environment node
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { HostContext } from "./hostTypes.ts";
import { closeTerminalsIn, terminalDir, terminalOpen } from "./hostTerminal.ts";
import { closeTerminal, openTerminal } from "./terminal.ts";

vi.stubEnv("SHELL", "/bin/sh");

const ctxWith = (agents: Record<string, object>) =>
  ({ agents: new Map(Object.entries(agents)) }) as unknown as HostContext;

it("starts a conversation's terminal in its worktree, waiting until it's made, not for the whole session", async () => {
  let placed = () => {};
  const agent = {
    workdir: "/repo",
    placed: new Promise<void>((resolve) => (placed = resolve)),
    opening: new Promise(() => {}),
  };
  const dir = terminalDir(ctxWith({ s1: agent }), "s1", "/repo");
  agent.workdir = "/wt/s1";
  placed();
  expect(await dir).toBe("/wt/s1");
});

it("starts in the fallback for no conversation, or one that isn't open", async () => {
  const ctx = ctxWith({});
  expect(await terminalDir(ctx, undefined, "/repo")).toBe("/repo");
  expect(await terminalDir(ctx, "gone", "/repo")).toBe("/repo");
});

it("starts where a conversation that failed to open works", async () => {
  const agent = { workdir: "/repo", placed: Promise.resolve() };
  expect(await terminalDir(ctxWith({ s1: agent }), "s1", "/wt")).toBe("/repo");
});

it("ends a worktree's terminals, and starts none there until it's removed", async () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "folder-")));
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
  const ctx = {
    agents: new Map(),
    send: () => {},
  } as unknown as HostContext;
  const open = (d: string) =>
    terminalOpen(ctx, {
      id: 1,
      type: "terminal_open",
      cwd,
      dir: d,
      cols: 80,
      rows: 24,
    });
  const inside = openTerminal(cwd, 80, 24, () => {}, dir);
  const removed = await closeTerminalsIn(dir);
  const during = await open(join(dir));
  expect(during.dir).toBeUndefined();
  removed();
  const after = await open(dir);
  expect(after.dir).toBe(dir);
  [inside, during, after].forEach((t) => closeTerminal(t.terminal));
});
