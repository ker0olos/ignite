// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostContext } from "./hostTypes.ts";

const forkSession = vi.fn();
const dropFork = vi.fn();
const open = vi.fn(async (_ctx: unknown, _cwd: string, id: string) => ({
  session: id,
}));
vi.mock("./forks.ts", async (real) => ({
  ...(await real<typeof import("./forks.ts")>()),
  forkSession,
  dropFork,
}));
vi.mock("./hostSession.ts", () => ({ open }));

const { fork } = await import("./hostFork.ts");
const { takeNotes } = await import("./forks.ts");

const host = () =>
  ({
    sessions: { create: () => "copy" },
    workspaces: { fork: vi.fn(async () => {}) },
    agents: new Map([["first", { title: "Plan it", running: false }]]),
  }) as unknown as HostContext;

beforeEach(() => {
  forkSession.mockClear();
  takeNotes("first");
});

describe("fork", () => {
  it("copies the conversation and its files, tells the original, and shows the fork", async () => {
    const ctx = host();
    expect(await fork(ctx, "/work", "first", "run the benchmarks")).toEqual({
      session: "copy",
    });
    expect(forkSession).toHaveBeenCalledWith(
      "/work",
      "first",
      "copy",
      "run the benchmarks",
    );
    expect(ctx.workspaces.fork).toHaveBeenCalledWith("/work", "first", "copy");
    expect(takeNotes("first")[0]).toContain(
      "forked this conversation into a new one (copy) to work on: run the benchmarks",
    );
  });

  it("names a fork with no first message after its original", async () => {
    await fork(host(), "/work", "first");
    expect(forkSession.mock.calls[0][3]).toBe("Fork of Plan it");
  });

  it.each([
    ["mid-run", { running: true }],
    ["while the router reads its message", { routing: {} }],
    ["with messages queued", { session: { pendingMessageCount: 1 } }],
  ])("refuses to fork a conversation %s", async (_, busy) => {
    const ctx = host();
    Object.assign(ctx.agents.get("first")!, busy);
    await expect(fork(ctx, "/work", "first")).rejects.toThrow(
      "Wait for this conversation's run to end",
    );
    expect(forkSession).not.toHaveBeenCalled();
  });

  it("deletes the copy and tells the original nothing when the fork can't start", async () => {
    const ctx = host();
    vi.mocked(ctx.workspaces.fork).mockRejectedValueOnce(new Error("locked"));
    await expect(fork(ctx, "/work", "first")).rejects.toThrow("locked");
    expect(dropFork).toHaveBeenCalledWith("/work", "copy");
    expect(takeNotes("first")).toEqual([]);
  });
});
