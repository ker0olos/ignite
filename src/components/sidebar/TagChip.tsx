import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex max-w-full items-center rounded-md bg-foreground/5 leading-none text-muted-foreground";
// sm on sidebar rows; md in the tag editor.
const SIZES = {
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "gap-1 px-2.5 py-1 text-[13px]",
};

/** A tag as a pill: plain, removable (×), or a button that picks it. */
export function TagChip({
  tag,
  onRemove,
  onPick,
  size = "sm",
}: {
  tag: string;
  size?: keyof typeof SIZES;
  onRemove?: () => void;
  onPick?: () => void;
}) {
  if (onPick) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={cn(CHIP, SIZES[size], "hover:bg-foreground/10")}
      >
        <span className="truncate">{tag}</span>
      </button>
    );
  }
  return (
    <span className={cn(CHIP, SIZES[size])}>
      <span className="truncate">{tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag}`}
          className="rounded-full hover:text-foreground"
        >
          <X className={size === "md" ? "size-3" : "size-2.5"} />
        </button>
      )}
    </span>
  );
}
