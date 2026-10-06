import type { ReactNode } from "react";
import { SidebarResizableProjectSplit } from "@/components/sidebar/SidebarResizableProjectSplit";

/** Sidebar conversations above files, matching the old fixed layout unless resizing is enabled. */
export function SidebarProjectSplit({
  conversations,
  files,
  resizable,
}: {
  conversations: ReactNode;
  /** Null: no files pane, the conversations fill the column. */
  files: ReactNode;
  resizable: boolean;
}) {
  if (!files) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations}
      </div>
    );
  }

  if (resizable) {
    return (
      <SidebarResizableProjectSplit
        conversations={conversations}
        files={files}
      />
    );
  }

  return (
    <>
      <div className="mb-2 max-h-[40%] shrink-0 overflow-y-auto border-b border-sidebar-border px-2 pb-2">
        {conversations}
      </div>
      <nav className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
        {files}
      </nav>
    </>
  );
}
