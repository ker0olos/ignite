import { createElement, useEffect, useState } from "react";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { fileIcon } from "@/lib/fileIcons";
import { listDir } from "@/lib/files";
import { cn } from "@/lib/utils";

type TreeProps = {
  selected: string | null;
  onOpenFile: (path: string) => void;
  hideGitIgnored: boolean;
};

/** Lazy directory tree: folders load their children when first expanded. */
export function FileTree({ root, ...props }: TreeProps & { root: string }) {
  return <Entries dir={root} depth={0} {...props} />;
}

function Entries({
  dir,
  depth,
  ...props
}: TreeProps & { dir: string; depth: number }) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const { hideGitIgnored } = props;

  useEffect(() => {
    listDir(dir, hideGitIgnored).then(setEntries, () => setEntries([]));
  }, [dir, hideGitIgnored]);

  return entries.map((entry) => (
    <Entry
      key={entry.name}
      path={`${dir}/${entry.name}`}
      entry={entry}
      depth={depth}
      {...props}
    />
  ));
}

function Entry({
  path,
  entry,
  depth,
  ...props
}: TreeProps & { path: string; entry: DirEntry; depth: number }) {
  const { selected, onOpenFile } = props;
  const [open, setOpen] = useState(false);
  const icon = createElement(
    entry.isDirectory ? (open ? FolderOpen : Folder) : fileIcon(entry.name),
    { className: "size-4 shrink-0 text-muted-foreground" },
  );

  return (
    <>
      <button
        title={entry.name}
        onClick={() => (entry.isDirectory ? setOpen(!open) : onOpenFile(path))}
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
      {open && <Entries dir={path} depth={depth + 1} {...props} />}
    </>
  );
}
