import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

// A drag of the window's edge resizes it many times a second; it's read once that settles.
const SETTLE_MS = 100;

/** Whether this window is maximized, read again once a resize settles. */
export function useMaximized() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    const read = () => void win.isMaximized().then(setMaximized, () => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    read();
    const off = win.onResized(() => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      void off.then((unlisten) => unlisten());
    };
  }, []);
  return maximized;
}
