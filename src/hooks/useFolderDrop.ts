import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

/** Calls `onDrop` for each path dropped on the window; returns whether a drag is hovering. */
export function useFolderDrop(onDrop: (path: string) => void) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "leave") return setDragging(false);
      if (payload.type !== "drop") return setDragging(true);
      setDragging(false);
      // ponytail: dropped files are accepted as folders too; stat via plugin-fs if that bites
      // Reversed so the first dropped path ends up most recent.
      [...payload.paths].reverse().forEach(onDrop);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [onDrop]);

  return dragging;
}
