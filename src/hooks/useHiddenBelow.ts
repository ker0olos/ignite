import { useLayoutEffect, useRef, useState } from "react";

/** How many of a scrolling list's children end below its visible area; re-measure with `update` on scroll. */
export function useHiddenBelow<T extends HTMLElement>(deps: unknown) {
  const ref = useRef<T>(null);
  const [hidden, setHidden] = useState(0);
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom;
    const rows = Array.from(el.children);
    setHidden(
      rows.filter((row) => row.getBoundingClientRect().bottom > bottom + 1)
        .length,
    );
  };
  useLayoutEffect(update, [deps]);
  return { ref, hidden, update };
}
