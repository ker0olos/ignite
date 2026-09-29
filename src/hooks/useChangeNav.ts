import { useEffect, useRef, type RefObject } from "react";
import { changeStarts, nextChange } from "@/lib/gitDiff";
import type { DiffLine } from "@/lib/toolRows";

type Container = RefObject<HTMLElement | null>;

function reveal(container: Container, row: number) {
  container.current
    ?.querySelector(`[data-row="${row}"]`)
    ?.scrollIntoView({ block: "center" });
}

/**
 * Steps through a diff's changes in `container` (rows marked `data-row`),
 * starting at the first, with ⌥F5 and ⇧⌥F5 as in VS Code.
 */
export function useChangeNav(lines: DiffLine[] | null, container: Container) {
  const at = useRef(-1);
  const starts = lines ? changeStarts(lines) : [];

  const go = (step: 1 | -1) => {
    const row = nextChange(starts, at.current, step);
    if (row === undefined) return;
    at.current = row;
    reveal(container, row);
  };

  useEffect(() => {
    const starts = lines ? changeStarts(lines) : [];
    if (starts.length === 0) return;
    at.current = starts[0];
    reveal(container, starts[0]);
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key !== "F5") return;
      e.preventDefault();
      const row = nextChange(starts, at.current, e.shiftKey ? -1 : 1);
      if (row === undefined) return;
      at.current = row;
      reveal(container, row);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines, container]);

  return { count: starts.length, go };
}
