import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortcut } from "@/lib/approvalKeys";

/** Zoom out and in; ⌘0 fits the image again. */
export function MarkupZoom({
  scale,
  onZoomOut,
  onZoomIn,
}: {
  scale: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
}) {
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        title={`Zoom out (${shortcut("-")})`}
        disabled={scale <= 1}
        onClick={onZoomOut}
      >
        <ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        title={`Zoom in (${shortcut("+")}, or pinch)`}
        onClick={onZoomIn}
      >
        <ZoomIn />
      </Button>
    </div>
  );
}
