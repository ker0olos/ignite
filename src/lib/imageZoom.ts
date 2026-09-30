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
