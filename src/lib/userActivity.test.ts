import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchActivity } from "./userActivity";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("hears a key, a click, focus and the page shown or hidden, at most once per gap", () => {
  const active = vi.fn();
  const stop = watchActivity(active, 5000);
  window.dispatchEvent(new KeyboardEvent("keydown"));
  window.dispatchEvent(new Event("pointerdown"));
  expect(active).toHaveBeenCalledOnce();
  for (const event of ["pointerdown", "focus", "blur"]) {
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event(event));
  }
  vi.advanceTimersByTime(5000);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(active).toHaveBeenCalledTimes(5);
  stop();
  vi.advanceTimersByTime(5000);
  window.dispatchEvent(new KeyboardEvent("keydown"));
  expect(active).toHaveBeenCalledTimes(5);
});
