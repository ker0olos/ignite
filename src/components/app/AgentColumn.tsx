import type { ComponentProps, ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { DockZone } from "@/components/app/DockZone";
import { EditorPane } from "@/components/app/EditorPane";
import { TabDragGhost } from "@/components/app/TabDragGhost";
import { SidebarSplitHandle } from "@/components/sidebar/SidebarSplitHandle";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { TabDragState } from "@/hooks/useTabDrag";
import { tabLabel } from "@/lib/diffTabs";

/** The conversation, the tabs docked under it, and, while a tab drags, the empty docks to drop it in. */
export function AgentColumn({
  agent,
  drag,
  ...pane
}: Omit<ComponentProps<typeof EditorPane>, "dock" | "active"> & {
  agent: ReactNode;
  drag: TabDragState;
}) {
  const { side, bottom } = pane.tabs;
  const dragged = drag.drag;
  const layout = useDefaultLayout({
    id: "agent-dock",
    panelIds: bottom.active ? ["conversation", "docked"] : ["conversation"],
    storage: localStorage,
  });
  return (
    <>
      <ResizablePanelGroup
        orientation="vertical"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <ResizablePanel id="conversation" minSize="160px">
          <div className="relative flex h-full flex-col">
            {agent}
            <DockZone dock="bottom" drag={dragged} empty={!bottom.active} />
            <DockZone dock="side" drag={dragged} empty={!side.active} />
          </div>
        </ResizablePanel>
        {bottom.active && <SidebarSplitHandle />}
        {bottom.active && (
          <ResizablePanel id="docked" defaultSize="40%" minSize="120px">
            <EditorPane
              {...pane}
              dock="bottom"
              drag={drag}
              active={bottom.active}
            />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
      {dragged && (
        <TabDragGhost
          name={tabLabel(dragged.tab, pane.folder, pane.terminalLabel).name}
          x={dragged.x}
          y={dragged.y}
        />
      )}
    </>
  );
}
