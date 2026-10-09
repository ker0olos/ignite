import { useEffect, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { blankImage } from "@/lib/images";

/** ⌘N (Ctrl+N elsewhere) opens a blank 1280×720 page to mark up while `enabled`; null while closed. */
export function useWhiteboard(enabled: boolean) {
  const [page, setPage] = useState<ImageContent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "n") return;
      // After every listener ran: a question's ⌘N (own answer) wins.
      setTimeout(() => !e.defaultPrevented && setPage(blankImage(1280, 720)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return [page, () => setPage(null)] as const;
}
