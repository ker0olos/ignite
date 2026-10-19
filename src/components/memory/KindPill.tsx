import { Button } from "@/components/ui/button";
import { OBSERVATION_ICONS } from "@/components/memory/observationIcons";
import { cn } from "@/lib/utils";

/** One type filter: its icon, name and count; pressed while it is the one shown. */
export function KindPill({
  kind,
  label,
  count,
  pressed,
  onPress,
}: {
  kind: string | null;
  label: string;
  count: number;
  pressed: boolean;
  onPress: () => void;
}) {
  const Icon = kind ? OBSERVATION_ICONS[kind] : undefined;
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
