// @vitest-environment node
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { Agent, HostContext } from "./hostTypes.ts";
import {
  closeTerminalsIn,
  releaseWorkspace,
  terminalDir,
  terminalOpen,
} from "./hostTerminal.ts";
import { closeTerminal, openTerminal, terminalsStartedIn } from "./terminal.ts";

vi.stubEnv("SHELL", "/bin/sh");

const ctxWith = (agents: Record<string, object>, shown: string | null = null) =>
  ({
    agents: new Map(Object.entries(agents)),
    shown,
  }) as unknown as HostContext;

it("starts a conversation's terminal in its worktree, waiting until it's made, not for the whole session", async () => {
  let placed = () => {};
  const agent = {
    cwd: "/repo",
    workdir: "/repo",
    placed: new Promise<void>((resolve) => (placed = resolve)),
    opening: new Promise(() => {}),
  };
  const dir = terminalDir(ctxWith({ s1: agent }), "/repo", "s1", "/repo");
  agent.workdir = "/wt/s1";
  placed();
  expect(await dir).toBe("/wt/s1");
});

it("starts one the app doesn't know the conversation of in the folder's shown one", async () => {
  const agent = { cwd: "/repo", workdir: "/wt/s1", placed: Promise.resolve() };
  const ctx = ctxWith({ s1: agent }, "s1");
  expect(await terminalDir(ctx, "/repo", undefined, "/repo")).toBe("/wt/s1");
  // Another folder's shown conversation isn't this folder's.
  expect(await terminalDir(ctx, "/other", undefined, "/other")).toBe("/other");
});

it("starts in the fallback before a first message, or for a conversation that isn't open", async () => {
  const agent = { cwd: "/repo", workdir: "/wt/s1", placed: Promise.resolve() };
  const ctx = ctxWith({ s1: agent }, "s1");
  expect(await terminalDir(ctx, "/repo", null, "/repo")).toBe("/repo");
  expect(await terminalDir(ctx, "/repo", "gone", "/repo")).toBe("/repo");
});

it("ends a worktree's terminals before releasing it, also when its conversation failed to open", async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
  const inside = openTerminal("/", 80, 24, () => {}, dir);
  const close = vi.fn(async () => {});
  const ctx = { workspaces: { close } } as unknown as HostContext;
  const agent = { id: "s1", cwd: "/", workdir: dir } as Agent;
  await releaseWorkspace(ctx, agent);
  expect(terminalsStartedIn(dir)).toEqual([]);
  expect(close).toHaveBeenCalledWith("/", "s1");
  closeTerminal(inside.terminal);
});

it("ends a worktree's terminals, and starts none there until it's removed", async () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "folder-")));
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
  const ctx = {
    agents: new Map(),
    shown: null,
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
