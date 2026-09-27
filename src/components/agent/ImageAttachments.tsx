import { X } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { imageUrl } from "@/lib/images";

/** Thumbnail strip for images attached to the composer, each removable. */
export function ImageAttachments({
  images,
  onRemove,
}: {
  images: ImageContent[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-0.5 pt-3">
      {images.map((image, i) => (
        <div key={i} className="group/image relative">
          <img
            src={imageUrl(image)}
            alt=""
            className="size-14 rounded-md border object-cover"
          />
          <button
            type="button"
            aria-label="Remove image"
            className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover/image:flex"
            onClick={() => onRemove(i)}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
