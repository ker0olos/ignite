import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  revealedComment,
  revealedDone,
  subscribeDiffComments,
} from "@/lib/diffComments";

const FLASH: Keyframe[] = [
  {
    backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)",
    boxShadow: "0 0 0 2px var(--ring)",
  },
  { backgroundColor: "transparent", boxShadow: "0 0 0 2px transparent" },
];

/** A diff comment's card: scrolled into view and flashed when the comment is revealed (its attachment clicked). */
export function useCommentReveal(id: number) {
  const ref = useRef<HTMLDivElement>(null);
  const revealing =
    useSyncExternalStore(subscribeDiffComments, revealedComment) === id;
  useEffect(() => {
    if (!revealing) return;
    revealedDone(id);
    const card = ref.current;
    card?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    card?.animate?.(FLASH, {
      duration: 900,
      easing: "ease-out",
      iterations: 2,
    });
  }, [revealing, id]);
  return ref;
}
