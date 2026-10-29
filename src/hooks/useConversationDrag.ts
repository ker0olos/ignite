import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Where a dragged conversation would land: just before or after another of its folder's. */
export type ConversationDrop = { target: string; after: boolean };

/** The side of a row a drop on it would land. */
export type DropEdge = "before" | "after";

type Drag = { cwd: string; session: string; drop: ConversationDrop | null };

const THRESHOLD = 4;

/** The drop under a point: the `[data-conversation]` row of folder `cwd` it's over, above or below its middle. */
function dropAt(
  x: number,
  y: number,
  cwd: string,
  session: string,
): ConversationDrop | null {
  const row = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-conversation]");
  const target = row?.dataset.conversation;
  if (!row || !target || target === session || row.dataset.folder !== cwd)
    return null;
  const { top, height } = row.getBoundingClientRect();
  return { target, after: y > top + height / 2 };
}

// The click that ends a drag would show the row it started on.
function swallowClick() {
  const stop = (e: MouseEvent) => e.stopPropagation();
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, true));
}

/** Dragging a sidebar conversation by pointer to reorder its folder's; a press under a few pixels still clicks. */
export function useConversationDrag(
  onMove: (cwd: string, session: string, drop: ConversationDrop) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const move = useRef(onMove);
  const unlisten = useRef<(() => void) | null>(null);
  useEffect(() => {
    move.current = onMove;
  });
  useEffect(() => () => unlisten.current?.(), []);

  const start = useCallback(
    (cwd: string, session: string, e: ReactPointerEvent) => {
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
        const drop = dropAt(m.clientX, m.clientY, cwd, session);
        setDrag((d) =>
          d && d.drop?.target === drop?.target && d.drop?.after === drop?.after
            ? d
            : { cwd, session, drop },
        );
      };
      const end = (drop: ConversationDrop | null) => {
        unlisten.current?.();
        setDrag(null);
        if (drop) move.current(cwd, session, drop);
      };
      const onPointerUp = (u: PointerEvent) => {
        if (dragging) swallowClick();
        end(dragging ? dropAt(u.clientX, u.clientY, cwd, session) : null);
      };
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
    },
    [],
  );

  /** Row `session` of folder `cwd`: its data, whether it's dragged, where a drop on it would land. */
  const row = (cwd: string, session: string) => {
    const drop = drag?.cwd === cwd ? drag.drop : null;
    const edge: DropEdge | null =
      drop?.target === session ? (drop.after ? "after" : "before") : null;
    return {
      folder: cwd,
      dragging: drag?.session === session,
      edge,
      onPointerDown: (e: ReactPointerEvent) => start(cwd, session, e),
    };
  };

  return { drag, row };
}

export type ConversationDragState = ReturnType<typeof useConversationDrag>;
export type RowDrag = ReturnType<ConversationDragState["row"]>;
