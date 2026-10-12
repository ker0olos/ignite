// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  summarize,
}));
const summarize = vi.fn(async () => "2x faster");
const launch = vi.fn<
  (ctx: HostContext, cwd: string, id: string) => Promise<void>
>(async () => {});
vi.mock("./hostSession.ts", () => ({ open, close, prompt, launch }));
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
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "host-fork-"));
  forkSession.mockClear();
});

afterEach(() => {
  rmSync(process.env.PI_CODING_AGENT_DIR!, { recursive: true, force: true });
  delete process.env.PI_CODING_AGENT_DIR;
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
  const opened = (id: string) => ({
    id,
    session: {},
    opening: Promise.resolve({}),
  });
  const forked = (parentOpen = true) => {
    const ctx = host();
    if (!parentOpen) ctx.agents.clear();
    else Object.assign(ctx.agents.get("first")!, opened("first"));
    ctx.agents.set("copy", {
      id: "copy",
      title: "bench",
      forkOf: "first",
      session: {},
    } as never);
    return ctx;
  };
  const settled = () => new Promise((done) => setTimeout(done));
  const readNotes = () => {
    const file = join(
      process.env.PI_CODING_AGENT_DIR!,
      "fork-notes",
      "first.json",
    );
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  };

  beforeEach(() => {
    prompt.mockClear();
    close.mockClear();
    launch.mockClear();
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

  it("opens the original in the background and sends it the report when it isn't open", async () => {
    const ctx = forked(false);
    launch.mockImplementationOnce(async (c: HostContext, _cwd, id: string) => {
      c.agents.set(id, opened(id) as never);
    });
    await closeConversation(ctx, "/work", "copy");
    await settled();
    expect(launch).toHaveBeenCalledWith(ctx, "/work", "first");
    expect(prompt).toHaveBeenCalledWith(
      ctx,
      expect.stringContaining("2x faster"),
      undefined,
      "first",
    );
  });

  it("leaves the report for the original's next run when it can't open", async () => {
    launch.mockRejectedValueOnce(new Error("locked"));
    await closeConversation(forked(false), "/work", "copy");
    await settled();
    expect(prompt).not.toHaveBeenCalled();
    expect(takeNotes("first")[0]).toContain("2x faster");
  });

  it("leaves the report for the original's next run while another fork holds it", async () => {
    const ctx = forked(false);
    ctx.agents.set("other", { id: "other", forkOf: "first" } as never);
    await closeConversation(ctx, "/work", "copy");
    await settled();
    expect(launch).not.toHaveBeenCalled();
    expect(takeNotes("first")[0]).toContain("2x faster");
  });

  it("keeps the fork's last reply for the original until its summary is in", async () => {
    const reply = {
      role: "assistant",
      content: [{ type: "text", text: "all green" }],
    };
    unreported.mockReturnValueOnce({
      parent: "first",
      messages: [reply] as never,
    });
    let finish: (text: string) => void = () => {};
    summarize.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const ctx = forked();
    await closeConversation(ctx, "/work", "copy");
    expect(readNotes()).toEqual([expect.stringContaining("all green")]);
    finish("2x faster");
    await settled();
    expect(readNotes()).toEqual([]);
    expect(prompt).toHaveBeenCalledWith(
      ctx,
      expect.stringContaining("2x faster"),
      undefined,
      "first",
    );
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
