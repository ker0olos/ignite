import { useState } from "react";
import {
  clampPan,
  NO_ZOOM,
  pinch,
  ZOOM_STEP,
  zoomAt,
  type Zoom,
} from "@/lib/imageZoom";
import type { MarkupKeyAction } from "@/lib/markup";

type Point = { x: number; y: number };

// How much one wheel notch (or pinch step) zooms.
const WHEEL_ZOOM = 0.01;

/**
 * How far the markup editor is zoomed into the image and panned, within a
 * view of `size` (the image fitted to the window); never smaller than fitted.
 */
export function useMarkupView(size: { width: number; height: number }) {
  const [view, setView] = useState<Zoom>(NO_ZOOM);

  const zoomBy = (
    factor: number,
    at: Point = { x: size.width / 2, y: size.height / 2 },
  ) =>
    setView((v) =>
      clampPan(zoomAt(v, { x: at.x - v.x, y: at.y - v.y }, factor), size),
    );
  const panBy = (dx: number, dy: number) =>
    setView((v) => clampPan({ ...v, x: v.x + dx, y: v.y + dy }, size));
  const reset = () => setView(NO_ZOOM);

  return {
    view,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset,
    panBy,
    /** Two touches moved: zoom about their midpoint and pan along with it. */
    pinch(from: Parameters<typeof pinch>[0], to: Parameters<typeof pinch>[1]) {
      const { factor, at, dx, dy } = pinch(from, to);
      setView((v) => {
        const moved = { ...v, x: v.x + dx, y: v.y + dy };
        const on = { x: at.x - moved.x, y: at.y - moved.y };
        return clampPan(zoomAt(moved, on, factor), size);
      });
    },
    /** Pinch or ⌘/Ctrl-scroll zooms at the pointer; plain scrolling pans. */
    wheel(
      e: Pick<WheelEvent, "deltaX" | "deltaY" | "ctrlKey" | "metaKey">,
      at: Point,
    ) {
      if (e.ctrlKey || e.metaKey) zoomBy(Math.exp(-e.deltaY * WHEEL_ZOOM), at);
      else panBy(-e.deltaX, -e.deltaY);
    },
    /** Runs a zoom shortcut; false for any other action. */
    act(action: MarkupKeyAction) {
      if (action === "zoomIn") zoomBy(ZOOM_STEP);
      else if (action === "zoomOut") zoomBy(1 / ZOOM_STEP);
      else if (action === "zoomReset") reset();
      else return false;
      return true;
    },
  };
}
