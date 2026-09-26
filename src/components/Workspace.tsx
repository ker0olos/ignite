import { createElement, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { AgentPanel } from "@/components/AgentPanel";
import { FileView } from "@/components/FileView";
import { Sidebar } from "@/components/Sidebar";
import { fileIcon } from "@/lib/fileIcons";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";

/**
 * Everything shown for an open folder: sidebar, full-height agent panel, and
 * an editor pane that appears while files are open. Keyed by folder in App,
 * so open files reset per folder.
 */
export function Workspace({
  folder,
  hideGitIgnored,
  actions,
}: {
  folder: string;
  hideGitIgnored: boolean;
  actions: ReactNode;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);

  function openFile(path: string) {
    setFiles((f) => (f.includes(path) ? f : [...f, path]));
    setActive(path);
  }

  function closeFile(path: string) {
    const i = files.indexOf(path);
    const rest = files.filter((f) => f !== path);
    setFiles(rest);
    if (active === path) setActive(rest[Math.min(i, rest.length - 1)] ?? null);
  }

  return (
    <>
      <Sidebar
        folder={folder}
        actions={actions}
        selected={active}
        onOpenFile={openFile}
        hideGitIgnored={hideGitIgnored}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AgentPanel folder={folder} />
      </div>
      {active && (
        <div className="flex min-w-0 flex-1 flex-col border-l">
          <div
            data-tauri-drag-region
            className="flex h-13 shrink-0 items-end gap-0.5 overflow-x-auto border-b px-2"
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
                  onClick={() => setActive(path)}
                  className="flex items-center gap-1.5"
                >
                  {createElement(fileIcon(path), { className: "size-3.5" })}
                  {basename(path)}
                </button>
                <button
                  onClick={() => closeFile(path)}
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
          <FileView key={active} path={active} root={folder} />
        </div>
      )}
    </>
  );
}
