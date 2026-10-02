import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpinnerFrame } from "./useSpinnerFrame";

const reduced = (matches: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSpinnerFrame", () => {
  it("advances every 80ms and wraps", () => {
    reduced(false);
    const { result } = renderHook(() => useSpinnerFrame());
    expect(result.current).toBe("⠋");
    act(() => vi.advanceTimersByTime(80));
    expect(result.current).toBe("⠙");
    act(() => vi.advanceTimersByTime(80 * 9));
    expect(result.current).toBe("⠋");
  });

  it("stays still under reduced motion, with no timer", () => {
    reduced(true);
    const { result } = renderHook(() => useSpinnerFrame());
    expect(result.current).toBe("⠿");
    expect(vi.getTimerCount()).toBe(0);
  });
});
