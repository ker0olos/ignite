import { useState } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DiscardMarkupDialog } from "@/components/app/DiscardMarkupDialog";
import { MarkupEditor } from "@/components/app/MarkupEditor";
import { useImageTarget } from "@/hooks/useImageTarget";
import { imageUrl } from "@/lib/images";

/**
 * An image that opens over the window, ready to zoom into and mark up. The
 * result replaces it through `onEdit` (an unsent attachment), else it's added
 * to the showing chat or task input. Esc or a click outside closes it, first
 * asking to discard any markup worth keeping.
 */
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
  const target = useImageTarget();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = onEdit ?? (target && ((marked) => target.add(marked, name)));
  const close = () => {
    setOpen(false);
    setDirty(false);
    setConfirming(false);
  };
  const openChange = (next: boolean) => {
    if (next) setOpen(true);
    else if (dirty) setConfirming(true);
    else close();
  };
  return (
    <Dialog open={open} onOpenChange={openChange}>
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
      <DialogContent
        showCloseButton={false}
        // Covers the window, untransformed; clicks off the image and toolbar close it.
        onClick={(e) => e.target === e.currentTarget && openChange(false)}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center gap-3 overflow-hidden rounded-none bg-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ring-0 sm:max-w-none sm:p-6"
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <MarkupEditor
          image={image}
          name={name}
          doneLabel={onEdit ? "Save" : target?.label}
          paused={confirming}
          onDirty={setDirty}
          onDismiss={() => openChange(false)}
          onCancel={close}
          onSave={(marked) => {
            save?.(marked);
            close();
          }}
        />
        <DiscardMarkupDialog
          open={confirming}
          onOpenChange={setConfirming}
          onDiscard={close}
        />
      </DialogContent>
    </Dialog>
  );
}
