import { X } from "lucide-react";
import type { ImageContent } from "../../../shared/agentTypes";
import { ZoomableImage } from "@/components/app/ZoomableImage";

/** Thumbnail strip for images attached to the composer, each removable and markable. */
export function ImageAttachments({
  images,
  onRemove,
  onEdit,
}: {
  images: ImageContent[];
  onRemove: (index: number) => void;
  onEdit: (index: number, image: ImageContent) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-0.5 pt-3">
      {images.map((image, i) => (
        <div key={i} className="group/image relative">
          <ZoomableImage
            image={image}
            className="size-14 rounded-md border object-cover"
            onEdit={(marked) => onEdit(i, marked)}
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
