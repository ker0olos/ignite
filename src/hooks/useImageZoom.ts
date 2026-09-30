import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { NO_ZOOM, ZOOM_STEP, zoomAt, type Zoom } from "@/lib/imageZoom";

// Pointer travel below this is a click, not a drag.
const DRAG_PX = 4;

/** Click to zoom in at a point, shift-click to zoom out, drag to pan while zoomed. */
export function useImageZoom() {
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; from: Zoom } | null>(null);
  const moved = useRef(false);
  const [shift, setShift] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setShift(e.shiftKey);
    const onBlur = () => setShift(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      moved.current = false;
      if (zoom.scale === 1) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, from: zoom };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_PX) return;
      moved.current = true;
      setDragging(true);
      setZoom({ ...d.from, x: d.from.x + dx, y: d.from.y + dy });
    },
    onPointerUp() {
      drag.current = null;
      setDragging(false);
    },
    onClick(e: MouseEvent<HTMLElement>) {
      if (moved.current) return;
      const box = e.currentTarget.getBoundingClientRect();
      const at = { x: e.clientX - box.left, y: e.clientY - box.top };
      setZoom((z) => zoomAt(z, at, e.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP));
    },
  };
  const zoomingOut = shift && zoom.scale > 1;
  return { zoom, dragging, zoomingOut, handlers };
}
