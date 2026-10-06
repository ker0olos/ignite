import { useState } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

/** An image's two versions over each other, split by a line dragged across: before on its left, after on its right. */
export function ImageCompare({
  before,
  after,
  name,
}: {
  before: ImageContent;
  after: ImageContent;
  name: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <div className="relative mt-1 w-fit max-w-full overflow-hidden rounded-lg border select-none">
      <img
        src={imageUrl(after)}
        alt={`${name} after`}
        className={cn(
          "block max-h-96 max-w-full object-contain",
          // An SVG has no size of its own, so it gets a height.
          after.mimeType === "image/svg+xml" && "h-80 w-auto",
        )}
      />
      <img
        src={imageUrl(before)}
        alt={`${name} before`}
        className="absolute inset-0 size-full object-contain"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/80"
        style={{ left: `${split}%` }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label={`Compare ${name} before and after`}
        className="absolute inset-0 size-full cursor-ew-resize appearance-none opacity-0"
      />
    </div>
  );
}
