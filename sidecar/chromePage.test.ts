import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CDP_TIMEOUT, type Cdp } from "./chrome.ts";
import { settle } from "./chromePage.ts";

const cdp = (fail: () => Error, state = "complete") => {
  const send = vi.fn(async () => {
    if (send.mock.calls.length < 3) throw fail();
    return { result: { value: state } };
  });
  return { own: true, closed: false, send } as unknown as Cdp & {
    send: typeof send;
  };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("settle waits out a navigation's swapped context", async () => {
  const c = cdp(() => new Error("Execution context was destroyed"));
  const done = settle(c, "S");
  await vi.advanceTimersByTimeAsync(1000);
  await done;
  expect(c.send).toHaveBeenCalledTimes(3);
});

it("settle gives up at once on a page that stopped answering", async () => {
  const c = cdp(() => new Error(`Runtime.evaluate: ${CDP_TIMEOUT}`));
  const done = expect(settle(c, "S")).rejects.toThrow(CDP_TIMEOUT);
  await vi.advanceTimersByTimeAsync(1000);
  await done;
  expect(c.send).toHaveBeenCalledTimes(1);
});
