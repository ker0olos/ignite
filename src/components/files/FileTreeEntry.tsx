import { useState } from "react";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import { ChevronRight } from "lucide-react";
import { FileIcon } from "@/components/files/FileIcon";
import { FileTreeEntries } from "@/components/files/FileTreeEntries";
import type { TreeProps } from "@/components/files/FileTree";
import { isFolderOpen, setFolderOpen } from "@/lib/openFolders";
import { cn } from "@/lib/utils";

/** One file or folder row; a folder loads and shows its own entries when opened. */
export function FileTreeEntry({
  path,
  entry,
  depth,
  ...props
}: TreeProps & { path: string; entry: DirEntry; depth: number }) {
  const { selected, onOpenFile, rememberAs } = props;
  const [open, setOpen] = useState(
    () => entry.isDirectory && isFolderOpen(rememberAs(path)),
  );
  const toggle = () => {
    setFolderOpen(rememberAs(path), !open);
    setOpen(!open);
  };
  const icon = (
    <FileIcon
      name={entry.name}
      kind={entry.isDirectory ? (open ? "openFolder" : "folder") : "file"}
      className="size-4 shrink-0 text-muted-foreground"
    />
  );

  return (
    <>
      <button
        title={entry.name}
        onClick={() => (entry.isDirectory ? toggle() : onOpenFile(path))}
        style={{ paddingLeft: 4 + depth * 12 }}
        className={cn(
          "flex h-6 w-full items-center gap-1 rounded-md pr-2 text-left text-[13px]",
          path === selected
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
            !entry.isDirectory && "invisible",
          )}
        />
        {icon}
        <span className="ml-0.5 truncate">{entry.name}</span>
      </button>
      {open && <FileTreeEntries dir={path} depth={depth + 1} {...props} />}
    </>
  );
}
