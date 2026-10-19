import type { TabDragState } from "@/hooks/useTabDrag";
import type { Dock } from "@/lib/tabs";
import { cn } from "@/lib/utils";

/** While a tab drags and `dock` is empty, where to drop it: under the conversation or beside it. */
export function DockZone({
  dock,
  drag,
  empty,
}: {
  dock: Dock;
  drag: TabDragState["drag"];
  empty: boolean;
}) {
  if (!drag || !empty) return null;
  return (
    <div
      data-tab-dock={dock}
      className={cn(
        "absolute z-30 m-2 flex items-center justify-center rounded-lg border-2 border-dashed bg-background/80 text-[13px] text-muted-foreground",
        dock === "bottom"
          ? "inset-x-0 bottom-0 h-1/3"
          : "inset-y-0 right-0 w-1/3",
        drag.drop?.dock === dock && "border-ring bg-accent text-foreground",
      )}
    >
      {dock === "bottom"
        ? "Dock under the conversation"
        : "Dock beside the conversation"}
    </div>
  );
}
