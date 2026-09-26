import type { ReactNode } from "react";
import { FileTree } from "@/components/FileTree";
import { basename } from "@/lib/paths";

/** Left column: title-bar strip beside the traffic lights, then the file tree. */
export function Sidebar({
  folder,
  actions,
}: {
  folder: string;
  actions: ReactNode;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* pl-20 clears the native traffic lights */}
      <div
        data-tauri-drag-region
        className="flex h-13 shrink-0 items-center justify-end pr-2 pl-20"
      >
        {actions}
      </div>
      <span className="truncate px-4 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {basename(folder)}
      </span>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <FileTree key={folder} root={folder} />
      </nav>
    </aside>
  );
}
