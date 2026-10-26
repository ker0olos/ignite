import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One filter: its icon (if any), name and count; pressed while it is the one shown. */
export function FilterPill({
  icon: Icon,
  label,
  count,
  pressed,
  onPress,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  count: number;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        "h-7 gap-1.5 rounded-full px-2.5 text-xs",
        pressed ? "bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
      <span className="text-muted-foreground tabular-nums">
        {count.toLocaleString()}
      </span>
    </Button>
  );
}
