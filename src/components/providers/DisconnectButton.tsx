import { Button } from "@/components/ui/button";
import { confirmNative } from "@/lib/lifecycle";

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
    <Button
      variant="destructive"
      size="sm"
      disabled={disabled}
      onClick={() =>
        void confirmNative(
          `Disconnect ${title}? Its saved credentials are removed from this Mac. You can connect again anytime.`,
          "Disconnect",
        ).then((ok) => ok && onConfirm())
      }
    >
      Disconnect
    </Button>
  );
}
