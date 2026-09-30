import { useEffect, useState } from "react";

/** An element's content size, kept current as it resizes; attach the returned ref. */
export function useElementSize() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size] as const;
}
