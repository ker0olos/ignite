import type { ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { SidebarSplitHandle } from "@/components/sidebar/SidebarSplitHandle";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

/** Resizable sidebar split, with its height remembered per window. */
export function SidebarResizableProjectSplit({
  conversations,
  files,
}: {
  conversations: ReactNode;
  files: ReactNode;
}) {
  const layout = useDefaultLayout({
    id: "sidebar-project-split",
    panelIds: ["conversations", "files"],
    storage: localStorage,
  });

  return (
    <div className="min-h-0 flex-1">
      <ResizablePanelGroup
        orientation="vertical"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <ResizablePanel
          id="conversations"
          defaultSize="40%"
          minSize="96px"
          maxSize="70%"
        >
          <div className="h-full overflow-y-auto px-2 pb-2">
            {conversations}
          </div>
        </ResizablePanel>
        <SidebarSplitHandle />
        <ResizablePanel id="files" minSize="120px">
          <nav className="h-full overscroll-contain overflow-y-auto">
            {files}
          </nav>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
