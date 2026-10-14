import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export const ROWS_STEP = 40;
const AHEAD_PX = 800;

/** The first of `total` rows to draw: the newest, then older ones as the top of `scrollRef` nears while `shown`. */
export function useOlderRows(
  scrollRef: RefObject<HTMLElement | null>,
  total: number,
  shown: boolean,
) {
  const [from, setFrom] = useState(() => Math.max(0, total - ROWS_STEP));
  const start = Math.min(from, Math.max(0, total - ROWS_STEP));
  const height = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Rows added above keep what's on screen in place.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || height.current === null) return;
    el.scrollTop += el.scrollHeight - height.current;
    height.current = null;
  }, [start, scrollRef]);

  // Observed again after each step, so a top still in view asks for more.
  useEffect(() => {
    const top = topRef.current;
    if (!top || !shown || start === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        height.current = scrollRef.current?.scrollHeight ?? null;
        setFrom(Math.max(0, start - ROWS_STEP));
      },
      { root: scrollRef.current, rootMargin: `${AHEAD_PX}px 0px 0px 0px` },
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [start, shown, scrollRef]);

  return { start, topRef };
}
