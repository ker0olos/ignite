// @vitest-environment node
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forkSummary,
  idleCompaction,
  tapTurn,
  type Ask,
} from "./idleCompaction.ts";

const MIN = 60_000;

type Query = ReturnType<Ask>;
function reply(messages: object[], interrupt = vi.fn(async () => {})) {
  return Object.assign(
    (async function* () {
      yield* messages as SDKMessage[];
    })(),
    { interrupt },
  ) as unknown as Query;
}
const done = (result: string) => ({
  type: "result",
  subtype: "success",
  result,
});
const init = (id: string) => ({
  type: "system",
  subtype: "init",
  session_id: id,
});
const request = { type: "stream_event", event: { type: "message_start" } };

async function drain(q: Query) {
  for await (const m of q) void m;
}

describe("forkSummary", () => {
  const signal = new AbortController().signal;

  it("forks the session, unsaved, for one turn and returns its checkpoint", async () => {
    const ask = vi.fn<Ask>(() => reply([done("  ## Goal\nship it  ")]));
    expect(await forkSummary(ask, { resume: "cc1" }, signal)).toBe(
      "## Goal\nship it",
    );
    expect(ask.mock.calls[0]![0].options).toEqual({
      resume: "cc1",
      forkSession: true,
      persistSession: false,
      maxTurns: 1,
    });
  });

  it("stops a fork that reaches for a tool, and drops failed or empty replies", async () => {
    const interrupt = vi.fn(async () => {});
    const tool = {
      type: "stream_event",
      event: {
        type: "content_block_start",
        content_block: { type: "tool_use" },
      },
    };
    const fork = (q: Query) => forkSummary(() => q, {}, signal);
    expect(await fork(reply([tool, done("x")], interrupt))).toBeNull();
    expect(interrupt).toHaveBeenCalled();
    const error = { type: "result", subtype: "error_during_execution" };
    expect(await fork(reply([error]))).toBeNull();
    expect(await fork(reply([done(" ")]))).toBeNull();
    expect(await fork(reply([]))).toBeNull();
    const thrown = () => {
      throw new Error("spawn failed");
    };
    expect(await forkSummary(thrown, {}, signal)).toBeNull();
  });
});

describe("idleCompaction", () => {
  afterEach(() => vi.useRealTimers());

  const turn: Options = { tools: [], cwd: "/wt" };

  function setup({
    tokens = 250_000,
    provider = "claude-bridge",
    persisted = true,
  } = {}) {
    vi.useFakeTimers();
    const handlers: Record<string, (event: object, ctx: object) => unknown> =
      {};
    const ask = vi.fn<Ask>(() => reply([done("checkpoint")]));
    let leaf = "e9";
    let idle = true;
    const compact = vi.fn();
    const ctx = {
      model: { provider },
      getContextUsage: () => ({ tokens }),
      compact,
      isIdle: () => idle,
      hasPendingMessages: () => false,
      sessionManager: {
        getSessionId: () => "pi1",
        getSessionFile: () => (persisted ? "/s.jsonl" : undefined),
        getLeafId: () => leaf,
      },
    };
    idleCompaction(
      {
        on: (name: string, h: (typeof handlers)[string]) =>
          (handlers[name] = h),
      } as never,
      ask,
      (id) => (id === "pi1" ? "cc1" : undefined),
    );
    return {
      ask,
      compact,
      move: () => (leaf = "e10"),
      busy: () => (idle = false),
      settle: () => handlers.agent_settled!({ aborted: false }, ctx),
      start: () => handlers.agent_start!({}, ctx),
      shutdown: () => handlers.session_shutdown!({}, ctx),
      beforeCompact: () =>
        handlers.session_before_compact!(
          {
            preparation: {
              firstKeptEntryId: "e5",
              tokensBefore: 250_000,
              fileOps: {
                read: new Set(["b.ts", "a.ts"]),
                edited: new Set(["a.ts"]),
                written: new Set<string>(),
              },
            },
          },
          ctx,
        ),
    };
  }

  it("forks before the cache's hour is up, then compacts with its checkpoint once it is", async () => {
    const s = setup();
    await drain(tapTurn(reply([init("cc1"), request]), turn));
    s.settle();
    await vi.advanceTimersByTimeAsync(54 * MIN);
    expect(s.ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 * MIN);
    expect(s.ask.mock.calls[0]![0].options).toMatchObject({
      cwd: "/wt",
      forkSession: true,
    });
    // A /compact the user runs meanwhile is pi's own.
    expect(s.beforeCompact()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(s.compact).toHaveBeenCalledOnce();
    expect(s.beforeCompact()).toEqual({
      compaction: {
        summary:
          "checkpoint\n\n<read-files>\nb.ts\n</read-files>\n\n<modified-files>\na.ts\n</modified-files>",
        details: { readFiles: ["b.ts"], modifiedFiles: ["a.ts"] },
        firstKeptEntryId: "e5",
        tokensBefore: 250_000,
      },
    });
    s.compact.mock.calls[0]![0].onComplete();
    expect(s.beforeCompact()).toBeUndefined();
  });

  it("times the fork from the turn's last request, and skips one whose cache already expired", async () => {
    const s = setup();
    await drain(tapTurn(reply([init("cc1")]), turn));
    await vi.advanceTimersByTimeAsync(10 * MIN);
    s.settle();
    await vi.advanceTimersByTimeAsync(45 * MIN);
    expect(s.ask).toHaveBeenCalledOnce();

    const late = setup();
    await drain(tapTurn(reply([init("cc1")]), turn));
    await vi.advanceTimersByTimeAsync(56 * MIN);
    late.settle();
    await vi.advanceTimersByTimeAsync(120 * MIN);
    expect(late.ask).not.toHaveBeenCalled();
  });

  it("drops it all when the user comes back, pi is busy, or the conversation moved on", async () => {
    for (const interrupt of ["start", "busy", "move"] as const) {
      const s = setup();
      await drain(tapTurn(reply([init("cc1")]), turn));
      s.settle();
      await vi.advanceTimersByTimeAsync(56 * MIN);
      s[interrupt]();
      await vi.advanceTimersByTimeAsync(120 * MIN);
      expect(s.compact).not.toHaveBeenCalled();
    }
    const early = setup();
    await drain(tapTurn(reply([init("cc1")]), turn));
    early.settle();
    early.start();
    await vi.advanceTimersByTimeAsync(120 * MIN);
    expect(early.ask).not.toHaveBeenCalled();
  });

  it("leaves short conversations, other providers, subagents and closed or unrecorded ones alone", async () => {
    for (const options of [
      { tokens: 150_000 },
      { provider: "anthropic" },
      { persisted: false },
    ]) {
      const s = setup(options);
      await drain(tapTurn(reply([init("cc1")]), turn));
      s.settle();
      await vi.advanceTimersByTimeAsync(120 * MIN);
      expect(s.ask).not.toHaveBeenCalled();
    }
    const closed = setup();
    await drain(tapTurn(reply([init("cc1")]), turn));
    closed.shutdown();
    closed.settle();
    await vi.advanceTimersByTimeAsync(120 * MIN);
    expect(closed.ask).not.toHaveBeenCalled();
    // One-off summaries and askClaude aren't a conversation's turn.
    const unrecorded = setup();
    await drain(
      tapTurn(reply([init("cc1")]), { tools: [], persistSession: false }),
    );
    await drain(tapTurn(reply([init("cc1")]), { tools: ["Bash"] }));
    unrecorded.settle();
    await vi.advanceTimersByTimeAsync(120 * MIN);
    expect(unrecorded.ask).not.toHaveBeenCalled();
  });
});

it("hands the bridge its query, methods and all", async () => {
  const interrupt = vi.fn(async () => {});
  const q = tapTurn(reply([init("x"), done("ok")], interrupt), { tools: [] });
  await q.interrupt();
  expect(interrupt).toHaveBeenCalled();
  const seen: string[] = [];
  for await (const m of q) seen.push(m.type);
  expect(seen).toEqual(["system", "result"]);
});
