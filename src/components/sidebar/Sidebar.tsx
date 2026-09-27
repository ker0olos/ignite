import type { ComponentProps, ReactNode } from "react";
import { FileTree } from "@/components/files/FileTree";
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
      {/* The name sits beside the traffic lights and wraps below them when it doesn't fit. */}
      <div className="relative shrink-0">
        <div
          data-tauri-drag-region
          className="flex flex-wrap items-center pr-10 pb-1"
        >
          <div data-tauri-drag-region className="h-13 w-20 shrink-0" />
          <span
            data-tauri-drag-region
            className="min-w-0 truncate px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {basename(folder)}
          </span>
        </div>
        <div className="absolute top-0 right-2 flex h-13 items-center">
          {actions}
        </div>
      </div>
      {banner}
      <nav className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
        <div className="always-bounce px-2 pb-2">
          <FileTree root={folder} {...treeProps} />
        </div>
      </nav>
    </aside>
  );
}
