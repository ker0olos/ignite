import { Eraser, Redo2, Undo2 } from "lucide-react";
import { MarkupInk } from "@/components/app/MarkupInk";
import { MarkupTools } from "@/components/app/MarkupTools";
import { MarkupZoom } from "@/components/app/MarkupZoom";
import { Button } from "@/components/ui/button";
import type { useMarkup } from "@/hooks/useMarkup";
import type { useMarkupView } from "@/hooks/useMarkupView";
import { shortcut } from "@/lib/approvalKeys";

// Wrapped onto rows on a phone, dividers would dangle at the row ends.
const DIVIDER = "mx-1 h-5 w-px shrink-0 bg-border max-sm:hidden";

/**
 * Tools, ink, undo / redo / clear, zoom, and Cancel / Done (⌘Enter)
 * (`doneLabel`) under the image; with nowhere to save it, just Close.
 */
export function MarkupToolbar({
  markup,
  view,
  doneLabel,
  onCancel,
  onDone,
}: {
  markup: ReturnType<typeof useMarkup>;
  view: ReturnType<typeof useMarkupView>;
  doneLabel?: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex max-w-full shrink-0 flex-wrap items-center justify-center gap-1 rounded-lg border bg-popover p-1 text-[13px] text-popover-foreground shadow-lg">
      <MarkupTools tool={markup.tool} onTool={markup.setTool} />
      <div className={DIVIDER} />
      <MarkupInk
        color={markup.color}
        onColor={markup.setColor}
        size={markup.size}
        onSize={markup.setSize}
      />
      <div className={DIVIDER} />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        title={`Undo (${shortcut("Z")})`}
        disabled={!markup.canUndo}
        onClick={markup.undo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        title={`Redo (${shortcut("⇧Z")})`}
        disabled={!markup.canRedo}
        onClick={markup.redo}
      >
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear all"
        title="Clear all"
        disabled={markup.marks.length === 0}
        onClick={markup.clear}
      >
        <Eraser />
      </Button>
      <div className={DIVIDER} />
      <MarkupZoom
        scale={view.view.scale}
        onZoomOut={view.zoomOut}
        onZoomIn={view.zoomIn}
      />
      <div className={DIVIDER} />
      <Button variant="ghost" size="sm" onClick={onCancel}>
        {doneLabel ? "Cancel" : "Close"}
      </Button>
      {doneLabel && (
        <Button size="sm" onClick={onDone}>
          {doneLabel}
          <span className="text-[11px] opacity-55 max-sm:hidden">
            {shortcut("↵")}
          </span>
        </Button>
      )}
    </div>
  );
}
