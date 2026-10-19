import { useEffect, useState } from "react";

/** The dragged tab's name, following the pointer from (`x`, `y`); only it re-renders as the pointer moves. */
export function TabDragGhost({
  name,
  x,
  y,
}: {
  name: string;
  x: number;
  y: number;
}) {
  const [at, setAt] = useState({ x, y });
  useEffect(() => {
    const follow = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", follow);
    return () => window.removeEventListener("pointermove", follow);
  }, []);
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2 py-1 text-[13px] text-popover-foreground shadow-md"
      style={{ left: at.x + 12, top: at.y + 8 }}
    >
      {name}
    </div>
  );
}
