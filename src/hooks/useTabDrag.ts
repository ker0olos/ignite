import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Dock } from "@/lib/tabs";

/** Where a dragged tab would land: a dock and the index among its tabs. */
export type TabDrop = { dock: Dock; index: number };

/** `x` and `y` are where the drop last changed; the ghost follows the pointer on its own. */
type Drag = { tab: string; x: number; y: number; drop: TabDrop | null };

const sameDrop = (a: TabDrop | null, b: TabDrop | null) =>
  a?.dock === b?.dock && a?.index === b?.index;

const THRESHOLD = 4;

/** The drop under a point: the `[data-tab-dock]` it's in, before or after the `[data-tab]` it's over. */
function dropAt(x: number, y: number): TabDrop | null {
  const el = document.elementFromPoint(x, y);
  const zone = el?.closest<HTMLElement>("[data-tab-dock]");
  if (!zone) return null;
  const dock = zone.dataset.tabDock as Dock;
  const tabs = [...zone.querySelectorAll<HTMLElement>("[data-tab]")];
  const over = el?.closest<HTMLElement>("[data-tab]");
  const i = over ? tabs.indexOf(over) : -1;
  if (!over || i === -1) return { dock, index: tabs.length };
  const { left, width } = over.getBoundingClientRect();
  return { dock, index: x > left + width / 2 ? i + 1 : i };
}

/** Dragging a tab by pointer (Tauri's file drop takes over HTML drag and drop on Windows); a press under a few pixels still clicks. */
export function useTabDrag(
  onMove: (tab: string, dock: Dock, index: number) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const move = useRef(onMove);
  const unlisten = useRef<(() => void) | null>(null);
  useEffect(() => {
    move.current = onMove;
  });
  useEffect(() => () => unlisten.current?.(), []);

  const start = useCallback((tab: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    unlisten.current?.();
    const target = e.currentTarget;
    const pointer = e.pointerId;
    const from = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const onPointerMove = (m: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(m.clientX - from.x, m.clientY - from.y) < THRESHOLD)
          return;
        dragging = true;
        // Captured, the drag keeps its events over iframes (artifacts).
        target.setPointerCapture(pointer);
      }
      const drop = dropAt(m.clientX, m.clientY);
      // Only a new drop re-renders the panes, not every pointer move.
      setDrag((d) =>
        d && sameDrop(d.drop, drop)
          ? d
          : { tab, x: m.clientX, y: m.clientY, drop },
      );
    };
    const end = (drop: TabDrop | null) => {
      unlisten.current?.();
      setDrag(null);
      if (drop) move.current(tab, drop.dock, drop.index);
    };
    const onPointerUp = (u: PointerEvent) =>
      end(dragging ? dropAt(u.clientX, u.clientY) : null);
    const onCancel = () => end(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onCancel);
    unlisten.current = () => {
      unlisten.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, []);

  return { drag, start };
}

export type TabDragState = ReturnType<typeof useTabDrag>;
