import type { ComponentProps } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { EditorOverlay } from "@/components/app/EditorOverlay";
import { EditorPane } from "@/components/app/EditorPane";
import type { MobileWorkspace } from "@/components/app/MobileWorkspace";
import { PaneHandle } from "@/components/app/PaneHandle";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEditorOverlay } from "@/hooks/useEditorOverlay";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

/** The resizable panes: sidebar, conversation and, while tabs are open, the editor (which can draw over them). */
export function DesktopWorkspace({
  sidebar,
  agent,
  agentMinWidth,
  ...pane
}: ComponentProps<typeof MobileWorkspace> & {
  agentMinWidth: number;
}) {
  const { active } = pane.tabs;
  const overlay = useEditorOverlay(agentMinWidth, !!active);
  const sidebarWidth = useSidebarWidth();
  // Pane sizes persist, saved separately for with and without the editor.
  const layout = useDefaultLayout({
    id: "workspace",
    panelIds: active ? ["sidebar", "agent", "editor"] : ["sidebar", "agent"],
    storage: localStorage,
  });
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="relative flex-1"
      elementRef={overlay.group}
      data-glass
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <ResizablePanel
        id="sidebar"
        defaultSize="240px"
        minSize="180px"
        maxSize="480px"
        // Like VS Code: the sidebar keeps its width when the window resizes.
        groupResizeBehavior="preserve-pixel-size"
        disabled={overlay.dragging}
        panelRef={sidebarWidth.panel}
        onResize={sidebarWidth.onResize}
      >
        {sidebar}
      </ResizablePanel>
      <PaneHandle
        onPointerDown={sidebarWidth.hold}
        onKeyDown={sidebarWidth.hold}
      />
      <ResizablePanel
        id="agent"
        elementRef={overlay.agent}
        className="glass:bg-background"
        minSize={`${agentMinWidth}px`}
      >
        <div data-pane="agent" className="relative flex h-full flex-col">
          {agent}
        </div>
      </ResizablePanel>
      {active && <PaneHandle onPointerDown={() => overlay.follow()} />}
      {active && (
        <ResizablePanel id="editor" minSize="320px" panelRef={overlay.editor}>
          <EditorOverlay
            pane={overlay.pane}
            over={overlay.over}
            onDragEdge={() => overlay.follow(true)}
            onClose={overlay.close}
          >
            <EditorPane {...pane} active={active} />
          </EditorOverlay>
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  );
}
