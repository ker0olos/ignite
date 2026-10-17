import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One of the activity bar's buttons; JetBrains' shows its label under the icon. */
export function ActivityButton({
  label,
  Icon,
  active,
  labelled,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  labelled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={labelled ? undefined : label}
      aria-current={active || undefined}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        labelled
          ? cn(
              "h-14 w-19 text-[10px]",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )
          : // VS Code's: a bar on the left edge marks the active one.
            cn(
              "h-12 w-12 rounded-none border-l-2",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ),
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {labelled && label}
    </button>
  );
}
