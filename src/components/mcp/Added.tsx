import { Check } from "lucide-react";

/** Small checkmark shown for a preset or import row already in the config. */
export function Added() {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5" /> Added
    </span>
  );
}
