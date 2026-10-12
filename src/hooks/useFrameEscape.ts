import { useEffect } from "react";
import { ESCAPE_MESSAGE } from "@/lib/artifact";

/** Runs `onEscape` when Esc is pressed in an artifact's HTML frame, while `active`. */
export function useFrameEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === ESCAPE_MESSAGE) onEscape();
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [active, onEscape]);
}
