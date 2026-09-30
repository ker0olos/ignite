import { useImageZoom } from "@/hooks/useImageZoom";
import { cn } from "@/lib/utils";

/** The opened image: click to zoom in, shift-click to zoom out, drag to pan. */
export function ZoomedImage({
  src,
  name,
  svg,
}: {
  src: string;
  name: string;
  svg: boolean;
}) {
  const { zoom, dragging, zoomingOut, handlers } = useImageZoom();
  return (
    <img
      src={src}
      alt={name}
      draggable={false}
      {...handlers}
      style={{
        transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
      }}
      className={cn(
        "max-h-[85vh] max-w-[90vw] origin-top-left rounded-lg object-contain shadow-2xl select-none",
        // An SVG has no size of its own, so it gets one.
        svg && "w-[min(900px,90vw)]",
        dragging
          ? "cursor-grabbing"
          : "transition-transform " +
              (zoomingOut ? "cursor-zoom-out" : "cursor-zoom-in"),
      )}
    />
  );
}
