import { describe, expect, it } from "vitest";
import { skippable, skipWait } from "./skipWait.ts";

// Rejects as pi's bash does once its signal aborts.
const bash =
  (message = "polling…\n\nCommand aborted") =>
  (signal: AbortSignal) =>
    new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error(message))),
    );

const textOf = (done: unknown) =>
  (done as { content: { text: string }[] }).content[0].text;

describe("skippable", () => {
  it("returns the output so far when the user skips the wait", async () => {
    const run = skippable("call-1", undefined, bash());
    expect(skipWait("call-1")).toBe(true);
    const done = await run;
    expect(done).toMatchObject({ isError: false, details: { skipped: true } });
    expect(textOf(done)).toMatch(/^polling…\n\nThe user stopped waiting/);
  });

  it("explains a skip that landed before the command started", async () => {
    const run = skippable("call-2", undefined, bash("aborted"));
    skipWait("call-2");
    expect(textOf(await run)).toMatch(/^The user stopped waiting/);
  });

  it("still fails when the run itself is stopped", async () => {
    const stop = new AbortController();
    const run = skippable("call-3", stop.signal, bash());
    stop.abort();
    await expect(run).rejects.toThrow("Command aborted");
  });

  it("still fails when the command failed some other way as it was skipped", async () => {
    const run = skippable("call-4", undefined, bash("spawn bash ENOENT"));
    skipWait("call-4");
    await expect(run).rejects.toThrow("ENOENT");
  });

  it("passes results through, and forgets the call", async () => {
    await expect(skippable("call-5", undefined, async () => 1)).resolves.toBe(
      1,
    );
    expect(skipWait("call-5")).toBe(false);
  });
});
