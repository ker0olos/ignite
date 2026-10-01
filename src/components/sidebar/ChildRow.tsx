import { LoaderCircle, Square, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One subagent or background command under its conversation in the sidebar; opens its tab. */
export function ChildRow({
  icon: Icon,
  name,
  detail,
  running,
  selected,
  onOpen,
  onStop,
  onClear,
}: {
  icon: LucideIcon;
  name: string;
  detail?: string;
  running: boolean;
  selected: boolean;
  onOpen: () => void;
  /** Offered while it runs, when it can be stopped from here. */
  onStop?: () => void;
  /** Offered once it's finished: takes it off the sidebar. */
  onClear: () => void;
}) {
  const action = running
    ? onStop && { label: `Stop ${name}`, icon: Square, run: onStop }
    : { label: `Clear ${name}`, icon: X, run: onClear };
  return (
    <div
      className={cn(
        "group relative ml-6 flex h-6 items-center rounded-md",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <button
        onClick={onOpen}
        aria-current={selected || undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-[13px]"
      >
        {running ? (
          <LoaderCircle
            aria-label="Running"
            className="size-3.5 shrink-0 animate-spin text-warning"
          />
        ) : (
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {name}
        </span>
        {detail && (
          <span className="shrink-0 text-xs text-muted-foreground/70">
            {detail}
          </span>
        )}
      </button>
      {action && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            action.run();
          }}
          aria-label={action.label}
          title={action.label}
          className="mr-1 shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
        >
          <action.icon className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
