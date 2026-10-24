import { type RefObject, useLayoutEffect, useState } from "react";

/** Whether `ref`'s element is at least `min` pixels wide, followed as it resizes. */
export function useWidePane(ref: RefObject<HTMLElement | null>, min: number) {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWide(el.clientWidth >= min);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, min]);
  return wide;
}
