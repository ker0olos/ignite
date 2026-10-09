import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWhiteboard } from "@/hooks/useWhiteboard";

const press = (init: KeyboardEventInit, claim = false) => {
  const e = new KeyboardEvent("keydown", { cancelable: true, ...init });
  if (claim)
    window.addEventListener("keydown", (k) => k.preventDefault(), {
      once: true,
    });
  window.dispatchEvent(e);
  act(() => void vi.runAllTimers());
};

describe("useWhiteboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,AA",
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens a blank PNG page on ⌘N or Ctrl+N, and closes", () => {
    const { result } = renderHook(() => useWhiteboard(true));
    press({ key: "n", metaKey: true });
    expect(result.current[0]?.mimeType).toBe("image/png");
    act(() => result.current[1]());
    expect(result.current[0]).toBeNull();
    press({ key: "N", ctrlKey: true });
    expect(result.current[0]).not.toBeNull();
  });

  it("ignores other keys, Shift or Alt, and when disabled", () => {
    const { result, rerender } = renderHook(({ on }) => useWhiteboard(on), {
      initialProps: { on: true },
    });
    press({ key: "n" });
    press({ key: "m", metaKey: true });
    press({ key: "n", metaKey: true, shiftKey: true });
    press({ key: "n", metaKey: true, altKey: true });
    expect(result.current[0]).toBeNull();
    rerender({ on: false });
    press({ key: "n", metaKey: true });
    expect(result.current[0]).toBeNull();
  });

  it("leaves ⌘N to a listener that claimed it", () => {
    const { result } = renderHook(() => useWhiteboard(true));
    press({ key: "n", metaKey: true }, true);
    expect(result.current[0]).toBeNull();
  });
});
