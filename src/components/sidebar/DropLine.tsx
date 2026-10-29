import type { DropEdge } from "@/hooks/useConversationDrag";
import { cn } from "@/lib/utils";

/** Where a dragged row would land: a line in the gap above or below the row it's over. */
export function DropLine({ edge }: { edge: DropEdge | null }) {
  if (!edge) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-sidebar-primary",
        edge === "before" ? "-top-0.75" : "-bottom-0.75",
      )}
    />
  );
}
