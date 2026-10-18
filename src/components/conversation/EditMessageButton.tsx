import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Edit on a user message, shown while it's hovered or focused. */
export function EditMessageButton({
  disabled,
  onEdit,
}: {
  disabled: boolean;
  onEdit: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Edit message"
      disabled={disabled}
      onClick={onEdit}
      className="shrink-0 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground [@media(hover:none)]:opacity-100"
    >
      <Pencil />
    </Button>
  );
}
