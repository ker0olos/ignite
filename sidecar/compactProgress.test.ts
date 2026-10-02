// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { withSummaryProgress, type StreamFn } from "./compactProgress.ts";

async function* events(...deltas: [string, string][]) {
  for (const [type, delta] of deltas) yield { type, delta };
}

afterEach(() => vi.useRealTimers());

it("reports the summary's tokens as it streams, then puts the stream function back", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const original = vi.fn(() =>
    events(
      ["thinking_delta", "a".repeat(400)],
      ["text_delta", "b".repeat(400)],
      ["toolcall_delta", "c".repeat(4000)],
    ),
  );
  const agent = { streamFunction: original as unknown as StreamFn };
  const onTokens = vi.fn();
  const done = await withSummaryProgress(agent, onTokens, async () => {
    const stream = await (agent.streamFunction as () => Promise<unknown>)();
    await new Promise((r) => setTimeout(r, 0));
    return stream ? "compacted" : "none";
  });
  expect(done).toBe("compacted");
  // The first delta reports at once; the next waits out the 250ms.
  expect(onTokens.mock.calls).toEqual([[100]]);
  expect(agent.streamFunction).toBe(original);
});

it("puts the stream function back when compaction fails", async () => {
  const original = vi.fn() as unknown as StreamFn;
  const agent = { streamFunction: original };
  await expect(
    withSummaryProgress(agent, vi.fn(), async () => {
      throw new Error("Nothing to compact");
    }),
  ).rejects.toThrow("Nothing to compact");
  expect(agent.streamFunction).toBe(original);
});
