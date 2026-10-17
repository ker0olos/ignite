import { useEffect } from "react";

// Sent by ⌘W (Close Tab); cancelled once the IDE layouts' tab strip closed its front tab.
const CLOSE_FRONT_TAB = "close-front-tab";

/** Asks the tab strip to close its front tab; false once it did. */
export const closeFrontTab = () =>
  window.dispatchEvent(new Event(CLOSE_FRONT_TAB, { cancelable: true }));

/** In the VS Code and JetBrains layouts, ⌘W closes the strip's front tab, file or conversation. */
export function useFrontTabClose(close: (() => void) | null) {
  useEffect(() => {
    if (!close) return;
    const onClose = (e: Event) => {
      e.preventDefault();
      close();
    };
    window.addEventListener(CLOSE_FRONT_TAB, onClose);
    return () => window.removeEventListener(CLOSE_FRONT_TAB, onClose);
  }, [close]);
}
