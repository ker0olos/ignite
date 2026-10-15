import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";

afterEach(() => vi.useRealTimers());

describe("useOpenedOnce", () => {
  it("stays false until opened, then true after closing", () => {
    const load = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ open }) => useOpenedOnce(open, load),
      { initialProps: { open: false } },
    );
    expect(result.current).toBe(false);
    rerender({ open: true });
    expect(result.current).toBe(true);
    rerender({ open: false });
    expect(result.current).toBe(true);
  });

  it("loads the code after startup, and not once unmounted", () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => {});
    renderHook(() => useOpenedOnce(false, load));
    vi.advanceTimersByTime(2000);
    expect(load).toHaveBeenCalledOnce();

    const later = vi.fn(async () => {});
    const { unmount } = renderHook(() => useOpenedOnce(false, later));
    unmount();
    vi.advanceTimersByTime(2000);
    expect(later).not.toHaveBeenCalled();
  });
});
