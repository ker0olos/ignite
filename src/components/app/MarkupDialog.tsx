import { useState, type ReactNode } from "react";
import type { ImageContent } from "../../../shared/agentTypes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DiscardMarkupDialog } from "@/components/app/DiscardMarkupDialog";
import { MarkupEditor } from "@/components/app/MarkupEditor";
import { useImageTarget } from "@/hooks/useImageTarget";

/**
 * The markup editor over the whole window. The result goes to `onEdit`, else
 * to the showing conversation or task input. Esc or a click outside closes it,
 * first asking to discard any markup worth keeping.
 */
export function MarkupDialog({
  image,
  name,
  open,
  onOpenChange,
  onEdit,
  trigger,
}: {
  image: ImageContent;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (image: ImageContent) => void;
  trigger?: ReactNode;
}) {
  const target = useImageTarget();
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = onEdit ?? (target && ((marked) => target.add(marked, name)));
  const close = () => {
    onOpenChange(false);
    setDirty(false);
    setConfirming(false);
  };
  const openChange = (next: boolean) => {
    if (next) onOpenChange(true);
    else if (dirty) setConfirming(true);
    else close();
  };
  return (
    <Dialog open={open} onOpenChange={openChange}>
      {trigger}
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
