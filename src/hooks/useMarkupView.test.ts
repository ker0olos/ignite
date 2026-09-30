import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMarkupView } from "@/hooks/useMarkupView";

const setup = () =>
  renderHook(() => useMarkupView({ width: 200, height: 100 })).result;

describe("useMarkupView", () => {
  it("zooms in and out about the centre, and resets to fit", () => {
    const r = setup();
    act(() => r.current.zoomIn());
    expect(r.current.view).toEqual({ scale: 1.5, x: -50, y: -25 });
    act(() => r.current.zoomOut());
    expect(r.current.view.scale).toBe(1);
    act(() => r.current.zoomIn());
    act(() => r.current.reset());
    expect(r.current.view).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("pinches or ⌘-scrolls to zoom at the pointer, scrolls to pan", () => {
    const r = setup();
    const wheel = { deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: false };
    act(() => r.current.wheel(wheel, { x: 0, y: 0 }));
    expect(r.current.view.scale).toBeCloseTo(Math.E);
    expect(r.current.view).toMatchObject({ x: 0, y: 0 });

    act(() =>
      r.current.wheel(
        { deltaX: 30, deltaY: 1000, ctrlKey: false, metaKey: false },
        { x: 0, y: 0 },
      ),
    );
    expect(r.current.view.x).toBe(-30);
    expect(r.current.view.y).toBeCloseTo(100 * (1 - Math.E));

    act(() => r.current.panBy(10, 0));
    expect(r.current.view.x).toBe(-20);
  });

  it("pinches about the touches' midpoint, and pans as they move", () => {
    const r = setup();
    act(() =>
      r.current.pinch(
        [
          { x: 90, y: 50 },
          { x: 110, y: 50 },
        ],
        [
          { x: 80, y: 50 },
          { x: 120, y: 50 },
        ],
      ),
    );
    expect(r.current.view).toEqual({ scale: 2, x: -100, y: -50 });
    act(() =>
      r.current.pinch(
        [
          { x: 80, y: 50 },
          { x: 120, y: 50 },
        ],
        [
          { x: 90, y: 60 },
          { x: 130, y: 60 },
        ],
      ),
    );
    expect(r.current.view).toEqual({ scale: 2, x: -90, y: -40 });
  });

  it("runs zoom shortcuts and passes on the rest", () => {
    const r = setup();
    act(() => void expect(r.current.act("zoomIn")).toBe(true));
    expect(r.current.view.scale).toBe(1.5);
    act(() => void r.current.act("zoomOut"));
    act(() => void r.current.act("zoomIn"));
    act(() => void r.current.act("zoomReset"));
    expect(r.current.view.scale).toBe(1);
    expect(r.current.act("undo")).toBe(false);
  });
});
