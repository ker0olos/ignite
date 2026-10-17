import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

/** The editor pane, or, while `over`, the same pane drawn over the panes to its left (its left edge set on `pane`). */
export function EditorOverlay({
  pane,
  over,
  onDragEdge,
  onClose,
  children,
}: {
  pane: RefObject<HTMLDivElement | null>;
  over: boolean;
  onDragEdge: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={pane}
      className={cn(
        "h-full",
        over &&
          // A narrowed window can't push it past the editor's minimum width.
          "absolute inset-y-0 right-0 left-[min(var(--overlay-left),calc(100%_-_320px))] z-20 border-l bg-background shadow-2xl",
      )}
    >
      {over && (
        <div
          role="separator"
          aria-orientation="vertical"
          className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize transition-colors hover:bg-ring"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onDragEdge();
          }}
          onDoubleClick={onClose}
        />
      )}
      {children}
    </div>
  );
}
