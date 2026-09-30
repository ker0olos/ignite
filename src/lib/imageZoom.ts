/** A zoomed image's scale and offset, applied as `translate(x, y) scale(scale)` from its top-left. */
export type Zoom = { scale: number; x: number; y: number };

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };

const MAX_SCALE = 8;

/** How much one click zooms in (shift-click divides by it). */
export const ZOOM_STEP = 1.5;

/**
 * Zooms by `factor` about `at` (from the image's shown top-left, in screen
 * px), keeping that point under the pointer; back at 1× it re-centres.
 */
export function zoomAt(
  zoom: Zoom,
  at: { x: number; y: number },
  factor: number,
): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(1, zoom.scale * factor));
  // Zooming in and back out by 1.5 can leave 1.0000000001.
  if (scale < 1.001) return NO_ZOOM;
  const k = 1 - scale / zoom.scale;
  return { scale, x: zoom.x + at.x * k, y: zoom.y + at.y * k };
}

/** `zoom` panned no further than keeps the zoomed image covering a view of `size`. */
export function clampPan(
  zoom: Zoom,
  size: { width: number; height: number },
): Zoom {
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    ...zoom,
    x: clamp(zoom.x, size.width * (1 - zoom.scale)),
    y: clamp(zoom.y, size.height * (1 - zoom.scale)),
  };
}

type Point = { x: number; y: number };

/** How two touches moved between `from` and `to`: the zoom, about their new midpoint, and how far that moved. */
export function pinch(from: [Point, Point], to: [Point, Point]) {
  const mid = ([a, b]: [Point, Point]) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const apart = ([a, b]: [Point, Point]) => Math.hypot(a.x - b.x, a.y - b.y);
  const was = mid(from);
  const at = mid(to);
  return {
    factor: apart(from) ? apart(to) / apart(from) : 1,
    at,
    dx: at.x - was.x,
    dy: at.y - was.y,
  };
}
