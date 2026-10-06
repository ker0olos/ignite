import type { ComponentProps, ReactNode } from "react";
import { FileTree } from "@/components/files/FileTree";
import {
  FolderList,
  type ProjectListProps,
} from "@/components/sidebar/FolderList";
import { OpenFolderButton } from "@/components/sidebar/OpenFolderButton";
import { SidebarProjectSplit } from "@/components/sidebar/SidebarProjectSplit";
import { basename } from "@/lib/paths";

/** Left column: title-bar strip beside the traffic lights, every folder, then the shown folder's files. */
export function Sidebar({
  folder,
  actions,
  banner,
  viewSwitch,
  projectList,
  footer,
  resizableProjectSplit,
  showTree,
  ...treeProps
}: Omit<ComponentProps<typeof FileTree>, "root"> & {
  folder: string;
  actions: ReactNode;
  /** Shown above the folder name, e.g. a sign-in warning. */
  banner?: ReactNode;
  /** Above the folders: the switch between conversation and tasks. */
  viewSwitch?: ReactNode;
  projectList: ProjectListProps;
  /** Below the files, e.g. the devices using remote access. */
  footer?: ReactNode;
  /** Lets the user drag the conversations/files divider. */
  resizableProjectSplit: boolean;
  /** Off, the folders take the whole column. */
  showTree: boolean;
}) {
  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* The name sits beside the traffic lights and wraps below them when it doesn't fit. */}
      <div className="relative shrink-0">
        <div
          data-tauri-drag-region
          className="flex flex-wrap items-center pr-20 pb-1"
        >
          {/* Room for the traffic lights; Windows has none. */}
          <div
            data-tauri-drag-region
            className="h-13 w-22 shrink-0 in-[.windows]:w-2"
          />
          <span
            data-tauri-drag-region
            className="min-w-0 truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {basename(folder)}
          </span>
        </div>
        <div className="absolute top-0 right-2 flex h-13 items-center gap-1">
          <OpenFolderButton onClick={projectList.onOpenFolder} />
          {actions}
        </div>
      </div>
      {banner}
      {viewSwitch && (
        <div className="mb-3 shrink-0 border-b border-sidebar-border px-2 pb-3">
          {viewSwitch}
        </div>
      )}
      <SidebarProjectSplit
        resizable={resizableProjectSplit}
        conversations={<FolderList folder={folder} {...projectList} />}
        files={
          showTree ? (
            <div className="always-bounce px-2 pb-2">
              <FileTree root={folder} {...treeProps} />
            </div>
          ) : null
        }
      />
      {footer}
    </aside>
  );
}
