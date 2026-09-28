import { useEffect, useRef, useState } from "react";
import { revealStep } from "@/lib/smoothText";

/** `text` revealed at a steady pace as it grows; text present at mount shows at once. */
export function useSmoothText(text: string): string {
  const [shown, setShown] = useState(text.length);
  const lastFrame = useRef(0);

  useEffect(() => {
    if (shown >= text.length) {
      lastFrame.current = 0;
      return;
    }
    const id = requestAnimationFrame((now) => {
      const frameMs = lastFrame.current ? now - lastFrame.current : 16;
      lastFrame.current = now;
      setShown((s) => revealStep(s, text.length, frameMs));
    });
    return () => cancelAnimationFrame(id);
  }, [shown, text.length]);

  return text.slice(0, Math.floor(shown));
}
