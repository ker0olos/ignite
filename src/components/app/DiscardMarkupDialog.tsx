import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Asks before closing an image with markup on it; Discard has focus, so Esc then Enter discards. */
export function DiscardMarkupDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  const discard = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" showCloseButton={false} initialFocus={discard}>
        <DialogHeader>
          <DialogTitle>Discard your markup?</DialogTitle>
          <DialogDescription>
            The drawing on this image will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep editing
          </DialogClose>
          <DialogClose
            ref={discard}
            render={<Button variant="destructive" />}
            onClick={onDiscard}
          >
            Discard
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
