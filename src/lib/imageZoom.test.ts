import { describe, expect, it } from "vitest";
import { NO_ZOOM, zoomAt } from "./imageZoom";

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
