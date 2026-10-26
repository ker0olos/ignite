// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostContext } from "./hostTypes.ts";

const forkSession = vi.fn();
const dropFork = vi.fn();
let files = Promise.resolve();
const start = vi.fn(
  (
    ctx: HostContext,
    _cwd: string,
    id: string,
    forking: { forkOf: string; files: () => Promise<void> },
  ) => {
    ctx.agents.set(id, { id, forkOf: forking.forkOf } as never);
    files = forking.files();
  },
);
const open = vi.fn(async (_ctx: unknown, _cwd: string, id: string) => {
  await files;
  return { session: id };
});
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
vi.mock("./hostSession.ts", () => ({ open, close, prompt, launch, start }));
vi.mock("./hostProjects.ts", async (real) => ({
  ...(await real<typeof import("./hostProjects.ts")>()),
  pushProjects: vi.fn(),
}));

const { closeConversation, fork, stopWaiting } = await import("./hostFork.ts");
const { noteFor, takeNotes } = await import("./forks.ts");
const { refuseWhileForked } = await import("./hostProjects.ts");

const host = () =>
  ({
    sessions: { create: () => "copy" },
    workspaces: { fork: vi.fn(async () => {}) },
    agents: new Map([["first", { title: "Plan it", running: false }]]),
    shown: "first",
    lastShown: new Map([["/work", "first"]]),
    send: vi.fn(),
  }) as unknown as HostContext;

beforeEach(() => {
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "host-fork-"));
  forkSession.mockClear();
  dropFork.mockClear();
  files = Promise.resolve();
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
      false,
    );
    expect(ctx.workspaces.fork).toHaveBeenCalledWith(
      "/work",
      "first",
      "copy",
      undefined,
    );
    expect(start).toHaveBeenCalledWith(
      ctx,
      "/work",
      "copy",
      expect.objectContaining({ title: "run the benchmarks", forkOf: "first" }),
    );
    expect(takeNotes("first")[0]).toContain(
      "forked this conversation into a new one (copy) to work on: run the benchmarks",
    );
  });

  it("names a fork with no first message after its original", async () => {
    await fork(host(), "/work", "first");
    expect(forkSession.mock.calls[0][3]).toBe("Fork of Plan it");
  });

  it("forks a running conversation from the message its run answers, files as they were then", async () => {
    const ctx = host();
    ctx.agents.get("first")!.running = true;
    forkSession.mockReturnValueOnce("entry-1");
    await fork(ctx, "/work", "first");
    expect(forkSession.mock.calls[0][4]).toBe(true);
    expect(ctx.workspaces.fork).toHaveBeenCalledWith(
      "/work",
      "first",
      "copy",
      "entry-1",
    );
  });

  it("deletes the copy and tells the original nothing when the fork can't start", async () => {
    const ctx = host();
    vi.mocked(ctx.workspaces.fork).mockRejectedValueOnce(new Error("locked"));
    vi.mocked(open).mockImplementationOnce(async () => {
      ctx.shown = "copy";
      ctx.lastShown.set("/work", "copy");
      await files;
      return { session: "copy" };
    });
    await expect(fork(ctx, "/work", "first")).rejects.toThrow("locked");
    expect(dropFork).toHaveBeenCalledWith("/work", "copy");
    expect(takeNotes("first")).toEqual([]);
    expect(ctx.send).toHaveBeenCalledWith({
      type: "conversation_dropped",
      cwd: "/work",
      session: "copy",
    });
    expect(ctx.shown).toBe("first");
    expect(ctx.lastShown.get("/work")).toBe("first");
  });

  it("tells the original nothing when the fork is closed while it opens", async () => {
    const ctx = host();
    vi.mocked(open).mockImplementationOnce(async () => {
      ctx.agents.delete("copy");
      return { session: "copy" };
    });
    await expect(fork(ctx, "/work", "first")).rejects.toThrow("closed");
    expect(takeNotes("first")).toEqual([]);
    expect(dropFork).not.toHaveBeenCalledWith("/work", "copy");
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

  it("stops the original waiting: the fork, detached for good, sends no report when closed", async () => {
    const ctx = forked();
    const appendCustomEntry = vi.fn();
    Object.assign(ctx.agents.get("copy")!, {
      session: { sessionManager: { appendCustomEntry } },
    });
    expect(stopWaiting(ctx, "first")).toBe(true);
    expect(() => refuseWhileForked(ctx, "first")).not.toThrow();
    expect(appendCustomEntry).toHaveBeenCalledWith("ignite-fork-detached");
    expect(takeNotes("first")[0]).toContain(
      'stopped you waiting for your fork "bench" (copy)',
    );
    expect(takeNotes("copy")[0]).toContain("stopped conversation first");
    expect(stopWaiting(ctx, "first")).toBe(false);
    await closeConversation(ctx, "/work", "copy");
    await settled();
    expect(close).toHaveBeenCalledWith(ctx, "/work", "copy");
    expect(unreported).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
  });

  it("stops the original waiting for a closed fork's report, which then comes as a note", async () => {
    let finish: (text: string) => void = () => {};
    summarize.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const ctx = forked();
    await closeConversation(ctx, "/work", "copy");
    expect(() => refuseWhileForked(ctx, "first")).toThrow();
    expect(stopWaiting(ctx, "first")).toBe(true);
    expect(() => refuseWhileForked(ctx, "first")).not.toThrow();
    finish("2x faster");
    await settled();
    expect(prompt).not.toHaveBeenCalled();
    expect(takeNotes("first")).toEqual([expect.stringContaining("2x faster")]);
  });

  it("wakes the original once released with the exits it was told of while it waited", async () => {
    const ctx = forked();
    const sendCustomMessage = vi.fn(async () => {});
    Object.assign(ctx.agents.get("first")!, {
      session: { sendCustomMessage },
      wakeOwed: true,
    });
    Object.assign(ctx.agents.get("copy")!, {
      session: { sessionManager: { appendCustomEntry: vi.fn() } },
    });
    noteFor("first", "npm run build exited with code 0");
    stopWaiting(ctx, "first");
    expect(sendCustomMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("exited with code 0"),
      }),
      { triggerTurn: true, deliverAs: "followUp" },
    );
    expect(takeNotes("first")).toEqual([]);
  });

  it("wakes the original once a fork with nothing to report closes", async () => {
    unreported.mockReturnValueOnce(null as never);
    const ctx = forked();
    const sendCustomMessage = vi.fn(async () => {});
    Object.assign(ctx.agents.get("first")!, {
      session: { sendCustomMessage },
      wakeOwed: true,
    });
    noteFor("first", "npm run build exited with code 0");
    await closeConversation(ctx, "/work", "copy");
    expect(sendCustomMessage).toHaveBeenCalledOnce();
  });

  it("opens the original for a fork's report while only a detached fork is left", async () => {
    const ctx = forked(false);
    ctx.agents.set("other", {
      id: "other",
      forkOf: "first",
      forkDetached: true,
    } as never);
    await closeConversation(ctx, "/work", "copy");
    expect(launch).toHaveBeenCalledWith(ctx, "/work", "first");
  });

  it("closes any other conversation as it is", async () => {
    const ctx = host();
    await closeConversation(ctx, "/work", "first");
    expect(close).toHaveBeenCalledWith(ctx, "/work", "first");
    expect(unreported).not.toHaveBeenCalled();
  });
});
