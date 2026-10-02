import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../../shared/agentTypes";
import { compactionOf, summaryProgress, tokenCount } from "@/lib/compaction";
import { toRows } from "@/lib/toolRows";
import { applyEvent, EMPTY, type Transcript } from "@/lib/transcript";

const run = (events: SessionEvent[], from: Transcript = EMPTY) =>
  events.reduce(applyEvent, from);

const result = { summary: "Did X.", tokensBefore: 84_000 };

describe("compaction", () => {
  it("runs /compact like a run, then shows its summary in place", () => {
    const started = run([{ type: "compaction_start", reason: "manual" }]);
    expect(started.items).toEqual([{ kind: "compaction" }]);
    expect(started.running).toBe(true);
    const done = run(
      [{ type: "compaction_end", reason: "manual", result, aborted: false }],
      started,
    );
    expect(done.items).toEqual([{ kind: "compaction", ...result }]);
    expect(done.running).toBe(false);
  });

  it("shows how much of the summary is written, and ignores progress with nothing running", () => {
    const t = run([
      { type: "compaction_start", reason: "manual" },
      { type: "compaction_progress", tokens: 300 },
    ]);
    expect(t.items).toEqual([{ kind: "compaction", written: 300 }]);
    expect(run([{ type: "compaction_progress", tokens: 3 }])).toBe(EMPTY);
  });

  it("leaves the run alone for compaction that happens on its own", () => {
    const working = { ...EMPTY, running: true };
    const t = run(
      [
        { type: "compaction_start", reason: "overflow" },
        { type: "compaction_end", reason: "overflow", result, aborted: false },
      ],
      working,
    );
    expect(t.running).toBe(true);
    expect(t.items).toEqual([{ kind: "compaction", ...result }]);
  });

  it.each([
    [{ aborted: true }, { kind: "notice", text: "Compaction stopped" }],
    [
      { aborted: false, errorMessage: "Nothing to compact" },
      { kind: "notice", text: "Nothing to compact", error: true },
    ],
    [
      { aborted: false },
      { kind: "notice", text: "Compaction failed.", error: true },
    ],
  ])("replaces the running line when it ends with %j", (end, item) => {
    const t = run([
      { type: "compaction_start", reason: "manual" },
      { type: "compaction_end", reason: "manual", ...end },
    ]);
    expect(t.items).toEqual([item]);
  });

  it("draws a saved conversation's compaction summary as its row", () => {
    const message = { role: "compactionSummary", ...result, timestamp: 1 };
    expect(toRows([{ kind: "message", message }])).toEqual([
      { kind: "compaction", ...result },
    ]);
  });

  it("reads a saved conversation's compaction summary", () => {
    expect(
      compactionOf({ role: "compactionSummary", ...result, timestamp: 1 }),
    ).toEqual({ kind: "compaction", ...result });
    expect(compactionOf({ role: "user", content: "hi", timestamp: 1 })).toBe(
      null,
    );
  });
});

describe("tokenCount", () => {
  it.each([
    [840, "840"],
    [84_400, "84k"],
    [1_250_000, "1.3M"],
    [2_000_000, "2M"],
  ])("words %d as %s", (n, text) => {
    expect(tokenCount(n)).toBe(text);
  });
});

describe("summaryProgress", () => {
  it("starts empty, nears full as a summary is written, never claims done", () => {
    expect(summaryProgress()).toBe(0);
    expect(summaryProgress(2000)).toBeCloseTo(0.6, 2);
    expect(summaryProgress(100_000)).toBeCloseTo(0.95, 5);
    expect(summaryProgress(100_000)).toBeLessThan(0.95 + 1e-9);
  });
});
