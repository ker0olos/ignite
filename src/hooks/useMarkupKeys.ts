import { useEffect, useRef } from "react";
import { markupKey, type MarkupKeyAction } from "@/lib/markup";

/**
 * Runs the markup editor's shortcuts, except while typing in a field. It
 * listens first, so a handled key (⌘+, Esc) never reaches the app or dialog.
 */
export function useMarkupKeys(act: (action: MarkupKeyAction) => boolean) {
  const latest = useRef(act);
  useEffect(() => {
    latest.current = act;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { target } = e;
      const typing =
        target instanceof Element &&
        target.closest("input, textarea, [contenteditable]");
      if (typing) return;
      const action = markupKey(e);
      if (!action || !latest.current(action)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
