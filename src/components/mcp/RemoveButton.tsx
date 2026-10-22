import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { confirmNative } from "@/lib/lifecycle";

/** Confirms before removing a server, since the agent loses its tools. */
export function RemoveButton({
  name,
  onConfirm,
  description = "The agent can no longer use its tools. You can add it again anytime.",
  variant = "ghost",
  icon = <Trash2 />,
}: {
  name: string;
  onConfirm: () => void;
  description?: string;
  variant?: "ghost" | "outline";
  icon?: ReactNode;
}) {
  return (
    <Button
      variant={variant}
      size="icon-sm"
      aria-label={`Remove ${name}`}
      title="Remove"
      onClick={() =>
        void confirmNative(`Remove ${name}? ${description}`, "Remove").then(
          (ok) => ok && onConfirm(),
        )
      }
    >
      {icon}
    </Button>
  );
}
