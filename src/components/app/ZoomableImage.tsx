import { XIcon } from "lucide-react";
import { useState } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ZoomedImage } from "@/components/app/ZoomedImage";
import { imageUrl } from "@/lib/images";

/** An image that opens full size over the window when clicked; Esc or × closes it. */
export function ZoomableImage({
  image,
  name = "Image",
  className,
}: {
  image: ImageContent;
  name?: string;
  className?: string;
}) {
  const src = imageUrl(image);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<button type="button" className="shrink-0 cursor-zoom-in" />}
        aria-label={`Open ${name}`}
      >
        <img src={src} alt={name} title={name} className={className} />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        // Covers the window, untransformed, so the × sits in its corner; clicks off the image close it.
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className="top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-hidden rounded-none bg-transparent p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <ZoomedImage
          src={src}
          name={name}
          svg={image.mimeType === "image/svg+xml"}
        />
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 z-10"
            />
          }
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
