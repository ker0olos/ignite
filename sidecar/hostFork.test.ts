// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostContext } from "./hostTypes.ts";

const forkSession = vi.fn();
const dropFork = vi.fn();
const open = vi.fn(async (_ctx: unknown, _cwd: string, id: string) => ({
  session: id,
}));
const prompt = vi.fn(async () => {});
const close = vi.fn(async (ctx: HostContext, _cwd: string, id?: string) => {
  ctx.agents.delete(id!);
});
const unreported = vi.fn(() => ({ parent: "first", messages: [] }));
vi.mock("./forks.ts", async (real) => ({
  ...(await real<typeof import("./forks.ts")>()),
  forkSession,
  dropFork,
  unreported,
  summarize: async () => "2x faster",
}));
vi.mock("./hostSession.ts", () => ({ open, close, prompt }));
vi.mock("./hostProjects.ts", async (real) => ({
  ...(await real<typeof import("./hostProjects.ts")>()),
  pushProjects: vi.fn(),
}));

const { closeConversation, fork } = await import("./hostFork.ts");
const { takeNotes } = await import("./forks.ts");
const { refuseWhileForked } = await import("./hostProjects.ts");

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

describe("closing a fork", () => {
  const forked = (parentOpen = true) => {
    const ctx = host();
    if (!parentOpen) ctx.agents.clear();
    else Object.assign(ctx.agents.get("first")!, { id: "first", session: {} });
    ctx.agents.set("copy", {
      id: "copy",
      title: "bench",
      forkOf: "first",
      session: {},
    } as never);
    return ctx;
  };
  const settled = () => new Promise((done) => setTimeout(done));

  beforeEach(() => {
    prompt.mockClear();
    close.mockClear();
  });

  it("keeps the original from taking messages until it closes, then sends it the report", async () => {
    const ctx = forked();
    expect(() => refuseWhileForked(ctx, "first")).toThrow(
      "Waiting for its fork",
    );
    await closeConversation(ctx, "/work", "copy");
    expect(close).toHaveBeenCalledWith(ctx, "/work", "copy");
    await settled();
    expect(prompt).toHaveBeenCalledWith(
      ctx,
      expect.stringContaining('Your fork "bench" (copy) is done'),
      undefined,
      "first",
    );
    expect(() => refuseWhileForked(ctx, "first")).not.toThrow();
  });

  it("leaves the report for the original's next run when it isn't open", async () => {
    await closeConversation(forked(false), "/work", "copy");
    await settled();
    expect(prompt).not.toHaveBeenCalled();
    expect(takeNotes("first")[0]).toContain("2x faster");
  });

  it("sends nothing when the fork did nothing new", async () => {
    unreported.mockReturnValueOnce(null as never);
    await closeConversation(forked(), "/work", "copy");
    await settled();
    expect(prompt).not.toHaveBeenCalled();
  });

  it("closes any other conversation as it is", async () => {
    const ctx = host();
    await closeConversation(ctx, "/work", "first");
    expect(close).toHaveBeenCalledWith(ctx, "/work", "first");
    expect(unreported).not.toHaveBeenCalled();
  });
});
