import { describe, expect, it } from "vitest";
import { clampPan, NO_ZOOM, pinch, zoomAt } from "./imageZoom";

describe("zoomAt", () => {
  it("keeps the clicked point still", () => {
    const zoom = zoomAt(NO_ZOOM, { x: 100, y: 50 }, 2);
    expect(zoom).toEqual({ scale: 2, x: -100, y: -50 });
    // The image-local point (100, 50) is still at screen offset 100, 50.
    expect(zoom.x + zoom.scale * 100).toBe(100);
    expect(zoom.y + zoom.scale * 50).toBe(50);
  });

  it("stops at 8x and re-centres at 1x", () => {
    let zoom = NO_ZOOM;
    for (let i = 0; i < 5; i++) zoom = zoomAt(zoom, { x: 0, y: 0 }, 2);
    expect(zoom.scale).toBe(8);
    expect(zoomAt({ scale: 2, x: -40, y: -9 }, { x: 5, y: 5 }, 0.5)).toBe(
      NO_ZOOM,
    );
    expect(zoomAt(NO_ZOOM, { x: 5, y: 5 }, 0.5)).toBe(NO_ZOOM);
    const back = [1.5, 1.5, 1.5, 1 / 1.5, 1 / 1.5, 1 / 1.5].reduce(
      (z, f) => zoomAt(z, { x: 7, y: 3 }, f),
      NO_ZOOM,
    );
    expect(back).toBe(NO_ZOOM);
  });
});

describe("clampPan", () => {
  const size = { width: 100, height: 50 };

  it("keeps a zoomed image covering the view", () => {
    expect(clampPan({ scale: 2, x: 30, y: -80 }, size)).toEqual({
      scale: 2,
      x: 0,
      y: -50,
    });
    expect(clampPan({ scale: 2, x: -40, y: -10 }, size)).toEqual({
      scale: 2,
      x: -40,
      y: -10,
    });
  });

  it("allows no panning at 1x", () => {
    expect(clampPan({ scale: 1, x: -5, y: 5 }, size)).toEqual(NO_ZOOM);
  });
});

describe("pinch", () => {
  it("zooms by how far the touches spread, about their midpoint, and pans with it", () => {
    const step = pinch(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 10 },
        { x: 30, y: 10 },
      ],
    );
    expect(step).toEqual({ factor: 3, at: { x: 15, y: 10 }, dx: 10, dy: 10 });
  });

  it("doesn't zoom from touches at one point", () => {
    const p = { x: 4, y: 4 };
    expect(pinch([p, p], [p, { x: 8, y: 4 }]).factor).toBe(1);
  });
});
