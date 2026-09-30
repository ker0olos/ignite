import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useImageZoom } from "./useImageZoom";

// The image's shown box starts at the window's top-left.
const target = {
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  setPointerCapture: () => {},
};
const at = (clientX: number, clientY: number, shiftKey = false) =>
  ({
    clientX,
    clientY,
    shiftKey,
    pointerId: 1,
    currentTarget: target,
  }) as never;

describe("useImageZoom", () => {
  it("zooms out while shift is held, once there's something to zoom out of", () => {
    const { result } = renderHook(() => useImageZoom());
    const key = (type: string, shiftKey: boolean) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent(type, { shiftKey }));
      });
    key("keydown", true);
    expect(result.current.zoomingOut).toBe(false);
    act(() => result.current.handlers.onClick(at(0, 0)));
    expect(result.current.zoomingOut).toBe(true);
    key("keyup", false);
    expect(result.current.zoomingOut).toBe(false);
    key("keydown", true);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.zoomingOut).toBe(false);
  });

  it("zooms in on a click and out on a shift-click", () => {
    const { result } = renderHook(() => useImageZoom());
    act(() => result.current.handlers.onClick(at(100, 50)));
    expect(result.current.zoom).toEqual({ scale: 1.5, x: -50, y: -25 });
    act(() => result.current.handlers.onClick(at(0, 0, true)));
    expect(result.current.zoom.scale).toBe(1);
  });

  it("drags only while zoomed, and a drag isn't a click", () => {
    const { result } = renderHook(() => useImageZoom());
    const h = () => result.current.handlers;
    act(() => h().onPointerDown(at(0, 0)));
    act(() => h().onPointerMove(at(50, 50)));
    expect(result.current.zoom.x).toBe(0);

    act(() => h().onClick(at(0, 0)));
    act(() => h().onPointerDown(at(10, 10)));
    act(() => h().onPointerMove(at(11, 11)));
    expect(result.current.dragging).toBe(false);
    act(() => h().onPointerMove(at(40, 30)));
    expect(result.current.zoom).toMatchObject({ scale: 1.5, x: 30, y: 20 });
    expect(result.current.dragging).toBe(true);
    act(() => h().onPointerUp());
    act(() => h().onClick(at(40, 30)));
    expect(result.current.zoom.scale).toBe(1.5);
    expect(result.current.dragging).toBe(false);
  });
});
