import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Edit on a user message, shown while it's hovered or focused; its tooltip says what editing does. */
export function EditMessageButton({
  disabled,
  filesStay,
  onEdit,
}: {
  disabled: boolean;
  filesStay: boolean;
  onEdit: () => void;
}) {
  const title = disabled
    ? "Edit once the agent is done"
    : filesStay
      ? "Edit: the conversation goes back to here; files stay as they are"
      : "Edit: the conversation and its files go back to here";
  return (
    // A disabled button gets no hover, so its tooltip sits on this wrapper.
    <span title={title} className="shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Edit message"
        disabled={disabled}
        onClick={onEdit}
        className="text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground [@media(hover:none)]:opacity-100"
      >
        <Pencil />
      </Button>
    </span>
  );
}
