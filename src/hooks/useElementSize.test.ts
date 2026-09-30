import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useElementSize } from "@/hooks/useElementSize";

class FakeObserver {
  static last: FakeObserver;
  observed: Element | null = null;
  disconnected = false;
  constructor(public report: (entries: unknown[]) => void) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed = el;
  }
  disconnect() {
    this.disconnected = true;
  }
}

describe("useElementSize", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the attached element's size until unmounted", () => {
    vi.stubGlobal("ResizeObserver", FakeObserver);
    const { result, unmount } = renderHook(() => useElementSize());
    expect(result.current[1]).toEqual({ width: 0, height: 0 });

    const el = document.createElement("div");
    act(() => result.current[0](el));
    expect(FakeObserver.last.observed).toBe(el);
    act(() =>
      FakeObserver.last.report([{ contentRect: { width: 300, height: 200 } }]),
    );
    expect(result.current[1]).toEqual({ width: 300, height: 200 });

    unmount();
    expect(FakeObserver.last.disconnected).toBe(true);
  });
});
