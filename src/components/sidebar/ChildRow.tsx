import {
  CircleAlert,
  LoaderCircle,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { ChildRowEnd } from "@/components/sidebar/ChildRowEnd";
import { cn } from "@/lib/utils";

/** One subagent or background command under its conversation in the sidebar; opens its tab. */
export function ChildRow({
  icon: Icon,
  name,
  detail,
  running,
  waiting,
  selected,
  onOpen,
  onStop,
  onClear,
  clearLabel = `Clear ${name}`,
  shortcut,
}: {
  icon: LucideIcon;
  name: string;
  detail?: string;
  running: boolean;
  /** Waits on the user (a fork's approval or question). */
  waiting?: boolean;
  selected: boolean;
  onOpen: () => void;
  /** Offered while it runs, when it can be stopped from here. */
  onStop?: () => void;
  /** Offered once it's finished: takes it off the sidebar. */
  onClear: () => void;
  clearLabel?: string;
  /** Its ⌘ digit, for a fork. */
  shortcut?: number;
}) {
  const action = running
    ? onStop && { label: `Stop ${name}`, icon: Square, run: onStop }
    : { label: clearLabel, icon: X, run: onClear };
  return (
    <div
      className={cn(
        "group relative ml-6 flex h-7 items-center rounded-md",
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
        {waiting ? (
          <CircleAlert
            aria-label="Waiting for you"
            className="size-3.5 shrink-0 text-warning"
          />
        ) : running ? (
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
      <ChildRowEnd action={action} shortcut={shortcut} />
    </div>
  );
}
