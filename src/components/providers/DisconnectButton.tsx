import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Confirms before removing a provider's saved credentials. */
export function DisconnectButton({
  title,
  disabled,
  onConfirm,
}: {
  title: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="destructive" size="sm" disabled={disabled} />}
      >
        Disconnect
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Disconnect {title}?</DialogTitle>
          <DialogDescription>
            Its saved credentials are removed from this Mac. You can connect
            again anytime.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={onConfirm}
          >
            Disconnect
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
