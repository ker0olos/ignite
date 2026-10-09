import { createElement } from "react";
import { X } from "lucide-react";
import { tabLabel } from "@/lib/diffTabs";
import { fileIcon } from "@/lib/fileIcons";
import { cn } from "@/lib/utils";

/** The editor pane's tab strip: one tab per open file, diff, subagent or background command. */
export function FileTabs({
  files,
  active,
  folder,
  onSelect,
  onClose,
}: {
  files: string[];
  active: string;
  folder: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <div
      data-tauri-drag-region
      className="flex shrink-0 flex-wrap items-end gap-0.5 border-b px-2 pt-4"
    >
      {files.map((path) => {
        const label = tabLabel(path, folder);
        return (
          <div
            key={path}
            title={label.title}
            className={cn(
              "group flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-t-md border border-b-0 pr-1.5 pl-3 text-[13px]",
              path === active
                ? "border-transparent bg-accent text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <button
              onClick={() => onSelect(path)}
              className="flex min-w-0 items-center gap-1.5 whitespace-nowrap"
            >
              {createElement(label.icon ?? fileIcon(label.iconPath), {
                className: "size-3.5 shrink-0",
              })}
              <span className="truncate">{label.name}</span>
              {label.detail && (
                <span className="text-xs text-muted-foreground italic">
                  ({label.detail})
                </span>
              )}
              {label.status && (
                <span className="text-xs text-muted-foreground">
                  {label.status}
                </span>
              )}
            </button>
            <button
              onClick={() => onClose(path)}
              aria-label={`Close ${label.name}`}
              className={cn(
                "shrink-0 rounded p-0.5 hover:bg-foreground/10",
                path !== active &&
                  "invisible group-hover:visible pointer-coarse:visible",
              )}
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
