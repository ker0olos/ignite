import { createElement, type PointerEvent } from "react";
import { X } from "lucide-react";
import { FileIcon } from "@/components/files/FileIcon";
import type { tabLabel } from "@/lib/diffTabs";
import { cn } from "@/lib/utils";

/** One tab of a strip; `marker` shows where a dragged tab would land beside it. */
export function FileTab({
  path,
  label,
  active,
  dragged,
  marker,
  onPointerDown,
  onSelect,
  onClose,
}: {
  path: string;
  label: ReturnType<typeof tabLabel>;
  active: boolean;
  dragged: boolean;
  marker: "before" | "after" | null;
  onPointerDown: (e: PointerEvent) => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-tab={path}
      title={label.title}
      onPointerDown={onPointerDown}
      className={cn(
        "group flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-t-md border border-b-0 pr-1.5 pl-3 text-[13px] select-none",
        active
          ? "border-transparent bg-accent text-foreground"
          : "border-border/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        dragged && "opacity-50",
        marker &&
          "relative before:absolute before:inset-y-2 before:w-0.5 before:rounded-full before:bg-primary",
        marker === "before" && "before:-left-[3px]",
        marker === "after" && "before:-right-[3px]",
      )}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap"
      >
        {label.icon ? (
          createElement(label.icon, { className: "size-3.5 shrink-0" })
        ) : (
          <FileIcon name={label.iconPath} className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{label.name}</span>
        {label.detail && (
          <span className="min-w-0 truncate text-xs text-muted-foreground italic">
            ({label.detail})
          </span>
        )}
        {label.status && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {label.status}
          </span>
        )}
      </button>
      <button
        onClick={onClose}
        aria-label={`Close ${label.name}`}
        className={cn(
          "shrink-0 rounded p-0.5 hover:bg-foreground/10",
          !active && "invisible group-hover:visible pointer-coarse:visible",
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
