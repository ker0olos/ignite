import { useCallback, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { isRemote } from "@/lib/remote";
import { isMac } from "@/lib/window";

// How far past the conversation's minimum width the pointer goes before the editor draws over it.
const SNAP = 48;
// Off the window's edge, where a drag would resize the window instead.
const EDGE = 12;
// Where macOS's traffic lights end (x 20, about 52px wide), plus a gap.
const LIGHTS = 96;
const ENDS = ["pointerup", "pointercancel", "blur"] as const;

/** The editor pane drawn over the sidebar and conversation once its edge is dragged past the conversation's minimum. */
export function useEditorOverlay(agentMinWidth: number, open: boolean) {
  const group = useRef<HTMLDivElement>(null);
  const agent = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const editor = useRef<PanelImperativeHandle>(null);
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setOver(false);
  }

  // `--overlay-left` and `--tabs-inset` go on the element, so a drag renders nothing.
  const follow = useCallback(
    (fromEdge = false) => {
      const g = group.current;
      const a = agent.current;
      if (!g || !a) return;
      setDragging(true);
      const lights = isMac() && !isRemote() ? LIGHTS : 0;
      const limit = a.getBoundingClientRect().left + agentMinWidth - SNAP;
      const box = g.getBoundingClientRect();
      const move = (e: PointerEvent) => {
        const drawn = e.clientX < limit;
        const left = Math.max(EDGE, e.clientX - box.left);
        const style = pane.current?.style;
        style?.setProperty("--overlay-left", `${left}px`);
        style?.setProperty("--tabs-inset", `${Math.max(0, lights - left)}px`);
        setOver(drawn);
        // The panels library isn't following a drag from the overlay's own edge.
        if (fromEdge && !drawn)
          editor.current?.resize(`${box.right - e.clientX}px`);
      };
      const stop = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        for (const type of ENDS) window.removeEventListener(type, stop);
      };
      window.addEventListener("pointermove", move);
      for (const type of ENDS) window.addEventListener(type, stop);
    },
    [agentMinWidth],
  );

  const close = useCallback(() => {
    pane.current?.style.removeProperty("--overlay-left");
    pane.current?.style.removeProperty("--tabs-inset");
    setOver(false);
  }, []);

  return { group, agent, pane, editor, over, dragging, follow, close };
}
