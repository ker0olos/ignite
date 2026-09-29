import { createElement } from "react";
import { X } from "lucide-react";
import { tabLabel } from "@/lib/diffTabs";
import { fileIcon } from "@/lib/fileIcons";
import { cn } from "@/lib/utils";

/** The editor pane's tab strip: one tab per open file. */
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
      className="no-scrollbar flex h-13 shrink-0 items-end gap-0.5 overscroll-contain overflow-x-auto border-b px-2"
    >
      {files.map((path) => {
        const label = tabLabel(path, folder);
        return (
          <div
            key={path}
            title={label.title}
            className={cn(
              "group flex h-9 shrink-0 items-center gap-1.5 rounded-t-md pr-1.5 pl-3 text-[13px]",
              path === active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <button
              onClick={() => onSelect(path)}
              className="flex items-center gap-1.5"
            >
              {createElement(fileIcon(label.iconPath), {
                className: "size-3.5",
              })}
              {label.name}
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
                "rounded p-0.5 hover:bg-foreground/10",
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
