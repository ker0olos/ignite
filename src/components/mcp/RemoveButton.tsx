import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmNative } from "@/lib/lifecycle";

/** Confirms before removing a server, since the agent loses its tools. */
export function RemoveButton({
  name,
  onConfirm,
  description = "The agent can no longer use its tools. You can add it again anytime.",
}: {
  name: string;
  onConfirm: () => void;
  description?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Remove ${name}`}
      title="Remove"
      onClick={() =>
        void confirmNative(`Remove ${name}? ${description}`, "Remove").then(
          (ok) => ok && onConfirm(),
        )
      }
    >
      <Trash2 />
    </Button>
  );
}
