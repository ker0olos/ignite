import { CircleAlert, LoaderCircle, X } from "lucide-react";
import type { ProjectStatus } from "../../../shared/hostProtocol";
import { basename, dirname, tildify } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** One project open in this window, in the sidebar's project list. */
export function ProjectRow({
  path,
  home,
  status,
  selected,
  onSelect,
  onClose,
}: {
  path: string;
  home: string;
  status?: ProjectStatus;
  selected?: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const label = status?.waiting
    ? "Needs approval"
    : status?.running
      ? "Working"
      : "Idle";

  return (
    <div
      className={cn(
        "group relative flex h-8 items-center rounded-md",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <button
        onClick={onSelect}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-[13px]"
      >
        <span
          title={label}
          aria-label={label}
          className="flex size-4 shrink-0 items-center justify-center"
        >
          {status?.waiting ? (
            <CircleAlert className="size-3.5 text-warning" />
          ) : status?.running ? (
            <LoaderCircle className="size-3.5 animate-spin text-warning" />
          ) : (
            <span className="size-2 rounded-full bg-success" />
          )}
        </span>
        <span className="shrink-0">{basename(path)}</span>
        <span className="truncate text-muted-foreground">
          {tildify(dirname(path), home)}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${basename(path)}`}
        className="mr-1 shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
