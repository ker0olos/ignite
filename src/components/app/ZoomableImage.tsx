import { useState } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { DialogTrigger } from "@/components/ui/dialog";
import { MarkupDialog } from "@/components/app/MarkupDialog";
import { imageUrl } from "@/lib/images";

/** An image that opens over the window, ready to zoom into and mark up (MarkupDialog). */
export function ZoomableImage({
  image,
  name = "Image",
  className,
  onEdit,
}: {
  image: ImageContent;
  name?: string;
  className?: string;
  onEdit?: (image: ImageContent) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <MarkupDialog
      image={image}
      name={name}
      open={open}
      onOpenChange={setOpen}
      onEdit={onEdit}
      trigger={
        <DialogTrigger
          render={<button type="button" className="shrink-0 cursor-zoom-in" />}
          aria-label={`Open ${name}`}
        >
          <img
            src={imageUrl(image)}
            alt={name}
            title={name}
            className={className}
          />
        </DialogTrigger>
      }
    />
  );
}
