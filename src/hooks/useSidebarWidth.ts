import { useCallback, useRef } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";

const KEY = "sidebar-width";
// After a drag or key on its edge ends, how long a resize still counts as the user's (a double-click's reset lands after it).
const SETTLE_MS = 500;

function saved() {
  const width = Number(localStorage.getItem(KEY));
  return width > 0 ? width : null;
}

/** The sidebar's width as the user last set it from its own edge (dragged, or `hold`), saved; any other change is put back. */
export function useSidebarWidth() {
  const panel = useRef<PanelImperativeHandle>(null);
  // Its edge: a drag can start beside it (the library's grab area is wider), never reaching `hold`.
  const handle = useRef<HTMLDivElement>(null);
  const width = useRef<number | null>(null);
  const held = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onResize = useCallback((size: PanelSize) => {
    width.current ??= saved() ?? size.inPixels;
    const dragged = handle.current?.dataset.separator === "active";
    if (held.current || dragged) {
      width.current = size.inPixels;
      localStorage.setItem(KEY, String(size.inPixels));
    } else if (size.inPixels !== width.current) {
      panel.current?.resize(`${width.current}px`);
    }
  }, []);

  const hold = useCallback(() => {
    held.current = true;
    clearTimeout(settle.current);
    const release = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("keyup", release);
      settle.current = setTimeout(() => {
        held.current = false;
      }, SETTLE_MS);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("keyup", release);
  }, []);

  return { panel, handle, onResize, hold };
}
