// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backgroundOf } from "./backgroundBash.ts";
import { delivered } from "./gitStatus.ts";
import { freeIfDelivered, revive, showOnly } from "./hostFree.ts";
import { terminalDir } from "./hostTerminal.ts";
import { reload, type Agent, type HostContext } from "./hostTypes.ts";
import { terminalsStartedIn } from "./terminal.ts";

vi.mock("./gitStatus.ts", () => ({ delivered: vi.fn() }));
vi.mock("./backgroundBash.ts", () => ({ backgroundOf: vi.fn() }));
vi.mock("./terminal.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./terminal.ts")>()),
  terminalsStartedIn: vi.fn(),
}));

const agentOf = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    cwd: "/repo",
    workdir: `/wt/${id}`,
    session: { messages: [], isStreaming: false, pendingMessageCount: 0 },
    running: false,
    approvals: new Map(),
    reloadWhenSettled: false,
    placed: Promise.resolve(),
    ready: Promise.resolve(),
    ...over,
  }) as unknown as Agent;

function setup(
  over: Record<string, unknown> = {},
  shown: string | null = null,
) {
  const agent = agentOf("a", over);
  const open = vi.fn(async () => ({ dir: "/wt/a", ready: Promise.resolve() }));
  // Freeing keeps the conversation's checkpoints: `free`, not `close`.
  const close = vi.fn(async () => {});
  const ctx = {
    agents: new Map([["a", agent]]),
    shown,
    workspaces: { open, free: close },
  } as unknown as HostContext;
  return { agent, ctx, open, close };
}

beforeEach(() => {
  vi.mocked(delivered).mockReset().mockResolvedValue(true);
  vi.mocked(backgroundOf).mockReset().mockReturnValue([]);
  vi.mocked(terminalsStartedIn).mockReset().mockReturnValue([]);
});

describe("freeIfDelivered", () => {
  it("saves and removes the worktree of a delivered, hidden, idle conversation", async () => {
    const { agent, ctx, close } = setup();
    await freeIfDelivered(ctx, agent);
    expect(close).toHaveBeenCalledWith("/repo", "a", expect.any(Function));
    expect(agent.freed).toBeInstanceOf(Promise);
    await agent.freed;
  });

  const blocked: [string, Record<string, unknown>, string | null][] = [
    ["shown", {}, "a"],
    ["running", { running: true }, null],
    [
      "streaming",
      { session: { messages: [], isStreaming: true, pendingMessageCount: 0 } },
      null,
    ],
    [
      "has queued messages",
      { session: { messages: [], isStreaming: false, pendingMessageCount: 1 } },
      null,
    ],
    ["routing", { routing: {} }, null],
    ["waiting on approval", { approvals: new Map([["x", {}]]) }, null],
    ["reloading when settled", { reloadWhenSettled: true }, null],
    ["in the user's folder", { workdir: "/repo" }, null],
    ["already freed", { freed: Promise.resolve() }, null],
  ];
  it.each(blocked)("keeps the worktree when %s", async (_n, over, shown) => {
    const { agent, ctx, close } = setup(over, shown);
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps it when the work isn't delivered", async () => {
    vi.mocked(delivered).mockResolvedValue(false);
    const { agent, ctx, close } = setup();
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
    expect(agent.freed).toBeUndefined();
  });

  it("keeps it when the conversation is no longer open", async () => {
    const { agent, ctx, close } = setup();
    ctx.agents.delete("a");
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps it while a background command runs or may wake the conversation", async () => {
    const { agent, ctx, close } = setup();
    vi.mocked(backgroundOf).mockReturnValue([{ running: true }] as never);
    await freeIfDelivered(ctx, agent);
    vi.mocked(backgroundOf).mockReturnValue([
      { running: false, wake: true },
    ] as never);
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
    expect(backgroundOf).toHaveBeenCalledWith("a");
    vi.mocked(backgroundOf).mockReturnValue([{ running: false }] as never);
    await freeIfDelivered(ctx, agent);
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps it while a terminal started in the worktree", async () => {
    const { agent, ctx, close } = setup();
    vi.mocked(terminalsStartedIn).mockReturnValue(["term-1"] as never);
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
    expect(terminalsStartedIn).toHaveBeenCalledWith("/wt/a");
  });

  it("keeps it when a message started while git was asked", async () => {
    const { agent, ctx, close } = setup();
    vi.mocked(delivered).mockImplementation(async () => {
      agent.sending = new Promise<void>(() => {});
      return true;
    });
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps it when it was shown while git was asked", async () => {
    const { agent, ctx, close } = setup();
    vi.mocked(delivered).mockImplementation(async () => {
      ctx.shown = "a";
      return true;
    });
    await freeIfDelivered(ctx, agent);
    expect(close).not.toHaveBeenCalled();
  });
});

it("waits for a cut-off run to resume, and keeps the worktree once it runs", async () => {
  let begun = () => {};
  const started = new Promise<void>((resolve) => (begun = resolve));
  const { agent, ctx, close } = setup({ resume: { started } });
  const freeing = freeIfDelivered(ctx, agent);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(delivered).not.toHaveBeenCalled();
  agent.running = true;
  begun();
  await freeing;
  expect(close).not.toHaveBeenCalled();
});

it("waits for a message handed while it waited on the one before", async () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  let first = () => {};
  let second = () => {};
  const { agent, ctx, close } = setup({
    sending: new Promise<void>((resolve) => (first = resolve)),
  });
  const freeing = freeIfDelivered(ctx, agent);
  await tick();
  agent.sending = new Promise<void>((resolve) => (second = resolve));
  first();
  await tick();
  expect(delivered).not.toHaveBeenCalled();
  agent.running = true;
  second();
  await freeing;
  expect(close).not.toHaveBeenCalled();
});

describe("showOnly", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("frees the conversation shown before, not the one now shown", async () => {
    const { agent, ctx, close } = setup({}, "a");
    const other = agentOf("b");
    ctx.agents.set("b", other);
    showOnly(ctx, "b");
    expect(ctx.shown).toBe("b");
    await vi.waitFor(() => expect(agent.freed).toBeDefined());
    expect(other.freed).toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it("frees nothing when the same one is shown again, or none was shown", async () => {
    const { ctx, close } = setup({}, "a");
    showOnly(ctx, "a");
    ctx.shown = null;
    showOnly(ctx, "a");
    await flush();
    expect(delivered).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("frees the one shown before when none is shown now", async () => {
    const { agent, ctx } = setup({}, "a");
    showOnly(ctx, null);
    await vi.waitFor(() => expect(agent.freed).toBeDefined());
  });
});

describe("revive", () => {
  it("returns where it was placed when nothing was freed", async () => {
    const { agent, ctx, open } = setup();
    const placed = agent.placed;
    expect(revive(ctx, agent)).toBe(placed);
    await placed;
    expect(open).not.toHaveBeenCalled();
    expect(agent.remade).toBeUndefined();
  });

  it("waits for the worktree to be removed, then makes it again", async () => {
    const { agent, ctx, open } = setup();
    let removed = () => {};
    agent.freed = new Promise<void>((resolve) => (removed = resolve));
    const ready = Promise.resolve();
    open.mockResolvedValue({ dir: "/wt/a", ready });
    const reviving = revive(ctx, agent);
    await Promise.resolve();
    expect(open).not.toHaveBeenCalled();
    removed();
    await reviving;
    expect(open).toHaveBeenCalledWith("/repo", "a");
    expect(agent.ready).toBe(ready);
    expect(agent.remade).toBe(1);
    expect(agent.freed).toBeUndefined();

    agent.freed = Promise.resolve();
    await revive(ctx, agent);
    expect(agent.remade).toBe(2);
  });

  it("reloads a session whose reload waited for the worktree", async () => {
    const reloaded = vi.fn(async () => {});
    const { agent, ctx } = setup({
      session: { messages: [], reload: reloaded },
    });
    agent.freed = Promise.resolve();
    await reload(agent);
    expect(reloaded).not.toHaveBeenCalled();
    await revive(ctx, agent);
    expect(reloaded).toHaveBeenCalledOnce();
    expect(agent.reloadWhenSettled).toBe(false);
  });

  it("makes it again before a terminal opens in it", async () => {
    const { agent, ctx, open } = setup();
    agent.freed = Promise.resolve();
    expect(await terminalDir(ctx, "/repo", "a", "/repo")).toBe("/wt/a");
    expect(open).toHaveBeenCalledOnce();
  });

  it("makes it once for concurrent callers", async () => {
    const { agent, ctx, open } = setup();
    agent.freed = Promise.resolve();
    await Promise.all([revive(ctx, agent), revive(ctx, agent)]);
    expect(open).toHaveBeenCalledOnce();
  });

  it("rejects when making it fails, and tries again next time", async () => {
    const { agent, ctx, open } = setup();
    agent.freed = Promise.resolve();
    open.mockRejectedValueOnce(new Error("disk full"));
    await expect(revive(ctx, agent)).rejects.toThrow("disk full");
    await revive(ctx, agent);
    expect(open).toHaveBeenCalledTimes(2);
    expect(agent.freed).toBeUndefined();
  });
});
