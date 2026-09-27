import type { ComponentProps, ReactNode } from "react";
import { FileTree } from "@/components/FileTree";
import { basename } from "@/lib/paths";

/** Left column: title-bar strip beside the traffic lights, then the file tree. */
export function Sidebar({
  folder,
  actions,
  banner,
  ...treeProps
}: Omit<ComponentProps<typeof FileTree>, "root"> & {
  folder: string;
  actions: ReactNode;
  /** Shown above the folder name, e.g. a sign-in warning. */
  banner?: ReactNode;
}) {
  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* pl-20 clears the native traffic lights */}
      <div
        data-tauri-drag-region
        className="flex h-13 shrink-0 items-center justify-end pr-2 pl-20"
      >
        {actions}
      </div>
      {banner}
      <span className="truncate px-4 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {basename(folder)}
      </span>
      <nav className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
        <div className="always-bounce px-2 pb-2">
          <FileTree root={folder} {...treeProps} />
        </div>
      </nav>
    </aside>
  );
}
