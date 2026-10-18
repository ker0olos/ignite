import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sortDrop } from "@/lib/drop";
import { dropPreview, peekDrop, type DropPreview } from "@/lib/dropPreview";
import { currentImageTarget } from "@/lib/imageTarget";

/**
 * Drops on the window: each folder is opened with `onFolder`; images and other files
 * go to the input showing (the composer). Returns the overlay for what hovers, or null.
 */
export function useDrop(onFolder: (path: string) => void) {
  const [preview, setPreview] = useState<DropPreview | null>(null);
  // Each drag's own: a slow sort for one that already left shows nothing.
  const drag = useRef(0);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "over") return;
      const id = ++drag.current;
      setPreview(null);
      if (payload.type === "enter") {
        const target = currentImageTarget();
        const takes = { images: !!target, files: !!target?.addFile };
        void peekDrop(payload.paths).then(
          (peeked) =>
            drag.current === id && setPreview(dropPreview(peeked, takes)),
        );
      }
      if (payload.type !== "drop") return;
      void sortDrop(payload.paths).then(({ folders, images, files }) => {
        // Reversed so the first dropped folder ends up most recent.
        [...folders].reverse().forEach(onFolder);
        const target = currentImageTarget();
        images.forEach(({ image, name }) => target?.add(image, name));
        files.forEach((file) => target?.addFile?.(file));
      });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [onFolder]);

  return preview;
}
