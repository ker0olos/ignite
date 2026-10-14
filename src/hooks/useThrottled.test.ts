import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThrottled } from "./useThrottled";

describe("useThrottled", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("changes at most once per interval, ending on the latest value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottled(value, 300),
      { initialProps: { value: "a" } },
    );
    act(() => vi.advanceTimersByTime(0));
    rerender({ value: "b" });
    rerender({ value: "c" });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("c");
  });
});
