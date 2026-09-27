import { createElement } from "react";
import { X } from "lucide-react";
import { fileIcon } from "@/lib/fileIcons";
import { basename } from "@/lib/paths";
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
      {files.map((path) => (
        <div
          key={path}
          title={path.slice(folder.length + 1)}
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
            {createElement(fileIcon(path), { className: "size-3.5" })}
            {basename(path)}
          </button>
          <button
            onClick={() => onClose(path)}
            aria-label={`Close ${basename(path)}`}
            className={cn(
              "rounded p-0.5 hover:bg-foreground/10",
              path !== active && "invisible group-hover:visible",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
