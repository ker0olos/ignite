import { useEffect, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import { blankImage } from "@/lib/images";

const blank = () => blankImage(1280, 720);

/** A blank 1280×720 page to mark up, opened by `open` or, while `enabled`, ⌘N (Ctrl+N elsewhere); null while closed. */
export function useWhiteboard(enabled: boolean) {
  const [page, setPage] = useState<ImageContent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "n") return;
      // After every listener ran: a question's ⌘N (own answer) wins.
      setTimeout(() => !e.defaultPrevented && setPage(blank()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return [page, () => setPage(null), () => setPage(blank())] as const;
}
