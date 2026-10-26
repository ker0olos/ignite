import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchActivity } from "./userActivity";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("hears a key, a click and scrolling, at most once per gap", () => {
  const active = vi.fn();
  const stop = watchActivity(active, 5000);
  window.dispatchEvent(new KeyboardEvent("keydown"));
  window.dispatchEvent(new Event("pointerdown"));
  expect(active).toHaveBeenCalledOnce();
  for (const event of ["pointerdown", "wheel"]) {
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event(event));
  }
  expect(active).toHaveBeenCalledTimes(3);
  stop();
  vi.advanceTimersByTime(5000);
  window.dispatchEvent(new KeyboardEvent("keydown"));
  expect(active).toHaveBeenCalledTimes(3);
});

it("doesn't take focus or the page shown or hidden for the user", () => {
  const active = vi.fn();
  const stop = watchActivity(active);
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("blur"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(active).not.toHaveBeenCalled();
  stop();
});
