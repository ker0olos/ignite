import { act, renderHook } from "@testing-library/react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

const size = (inPixels: number) => ({ inPixels, asPercentage: 0 });

function sidebar() {
  const { result } = renderHook(() => useSidebarWidth());
  const resize = vi.fn();
  result.current.panel.current = {
    resize,
  } as unknown as PanelImperativeHandle;
  return { result, resize };
}

const fire = (type: string) =>
  act(() => {
    window.dispatchEvent(new Event(type));
  });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("useSidebarWidth", () => {
  it("keep the first width it sees until the user sets one", () => {
    const { result, resize } = sidebar();
    act(() => result.current.onResize(size(260)));
    expect(resize).not.toHaveBeenCalled();
    act(() => result.current.onResize(size(180)));
    expect(resize).toHaveBeenLastCalledWith("260px");
  });

  it("start from the saved width", () => {
    localStorage.setItem("sidebar-width", "320");
    const { result, resize } = sidebar();
    act(() => result.current.onResize(size(240)));
    expect(resize).toHaveBeenLastCalledWith("320px");
  });

  it("keeps and saves a width dragged from beside its edge", () => {
    const { result, resize } = sidebar();
    const edge = document.createElement("div");
    result.current.handle.current = edge;
    act(() => result.current.onResize(size(240)));
    edge.dataset.separator = "active";
    act(() => result.current.onResize(size(300)));
    act(() => result.current.onResize(size(320)));
    expect(resize).not.toHaveBeenCalled();
    expect(localStorage.getItem("sidebar-width")).toBe("320");
    edge.dataset.separator = "inactive";
    act(() => result.current.onResize(size(200)));
    expect(resize).toHaveBeenLastCalledWith("320px");
  });

  it.each(["pointerup", "keyup"])(
    "keep and save the width set from its edge, until a moment after %s",
    (type) => {
      const { result, resize } = sidebar();
      act(() => result.current.onResize(size(240)));
      act(() => result.current.hold());
      act(() => result.current.onResize(size(300)));
      fire(type);
      // A double-click's reset lands just after the release.
      act(() => result.current.onResize(size(240)));
      expect(resize).not.toHaveBeenCalled();
      expect(localStorage.getItem("sidebar-width")).toBe("240");

      act(() => vi.advanceTimersByTime(500));
      act(() => result.current.onResize(size(200)));
      expect(resize).toHaveBeenLastCalledWith("240px");
    },
  );
});
