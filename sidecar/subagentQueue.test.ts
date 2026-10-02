import { describe, expect, it } from "vitest";
import { concurrency } from "./subagentQueue.ts";

/** A job that runs until `finish` is called. */
function job(log: string[], name: string) {
  let finish = () => {};
  const run = () =>
    new Promise<string>((done) => {
      log.push(name);
      finish = () => done(name);
    });
  return { run, finish: () => finish() };
}

const tick = () => new Promise((r) => setTimeout(r));

describe("concurrency", () => {
  it("runs at most max at once and starts the rest in order as slots free", async () => {
    const queue = concurrency(() => 2);
    const log: string[] = [];
    const [a, b, c] = ["a", "b", "c"].map((n) => job(log, n));
    const results = [queue(a.run), queue(b.run), queue(c.run)];
    await tick();
    expect(log).toEqual(["a", "b"]);
    a.finish();
    await tick();
    expect(log).toEqual(["a", "b", "c"]);
    b.finish();
    c.finish();
    expect(await Promise.all(results)).toEqual(["a", "b", "c"]);
  });

  it("frees the slot when a job fails", async () => {
    const queue = concurrency(() => 1);
    await expect(
      queue(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    expect(await queue(async () => "next")).toBe("next");
  });

  it("drops a waiting job when stopped, and refuses one already stopped", async () => {
    const queue = concurrency(() => 1);
    const log: string[] = [];
    const [a, b, c] = ["a", "b", "c"].map((n) => job(log, n));
    const first = queue(a.run);
    const stop = new AbortController();
    const waiting = queue(b.run, stop.signal);
    const after = queue(c.run);
    stop.abort();
    await expect(waiting).rejects.toThrow("Stopped while waiting");
    await expect(queue(b.run, stop.signal)).rejects.toThrow("Stopped");
    a.finish();
    await tick();
    expect(log).toEqual(["a", "c"]);
    c.finish();
    expect(await Promise.all([first, after])).toEqual(["a", "c"]);
  });

  it("reads max again as slots free", async () => {
    let max = 1;
    const queue = concurrency(() => max);
    const log: string[] = [];
    const [a, b, c] = ["a", "b", "c"].map((n) => job(log, n));
    const all = [queue(a.run), queue(b.run), queue(c.run)];
    await tick();
    expect(log).toEqual(["a"]);
    max = 3;
    a.finish();
    await tick();
    expect(log).toEqual(["a", "b", "c"]);
    b.finish();
    c.finish();
    await Promise.all(all);
  });
});
