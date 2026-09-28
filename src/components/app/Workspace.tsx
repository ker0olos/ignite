import type { ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { FileTabs } from "@/components/app/FileTabs";
import { PaneHandle } from "@/components/app/PaneHandle";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { FileView } from "@/components/files/FileView";
import { Sidebar } from "@/components/sidebar/Sidebar";
import type { ProjectListProps } from "@/components/sidebar/ProjectList";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import type { Approval } from "@/components/agent/Composer";

/**
 * Everything shown for an open folder: sidebar, full-height agent panel, and
 * an editor pane that appears while files are open. Tab state lives in App so
 * the menu (⌘W) can reach it.
 */
export function Workspace({
  folder,
  tabs,
  codeThemes,
  editor,
  hideGitIgnored,
  showThinking,
  approval,
  actions,
  projectList,
  banner,
  session,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  hideGitIgnored: boolean;
  showThinking: boolean;
  approval: Approval;
  actions: ReactNode;
  projectList: ProjectListProps;
  banner?: ReactNode;
  session: ReturnType<typeof useAgentSession>;
}) {
  const { files, active } = tabs;
  const openFile = tabs.open;
  const closeFile = tabs.close;
  const setActive = tabs.activate;

  // Pane sizes persist, saved separately for with and without the editor.
  const layout = useDefaultLayout({
    id: "workspace",
    panelIds: active ? ["sidebar", "agent", "editor"] : ["sidebar", "agent"],
    storage: localStorage,
  });

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex-1"
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
      >
        <Sidebar
          folder={folder}
          actions={actions}
          projectList={projectList}
          banner={banner}
          selected={active}
          onOpenFile={openFile}
          hideGitIgnored={hideGitIgnored}
        />
      </ResizablePanel>
      <PaneHandle />
      <ResizablePanel id="agent" minSize="320px">
        <div className="relative flex h-full flex-col">
          <AgentPanel
            folder={folder}
            session={session}
            codeThemes={codeThemes}
            editor={editor}
            showThinking={showThinking}
            approval={approval}
          />
        </div>
      </ResizablePanel>
      {active && <PaneHandle />}
      {active && (
        <ResizablePanel id="editor" minSize="320px">
          <div className="flex h-full min-w-0 flex-col">
            <FileTabs
              files={files}
              active={active}
              folder={folder}
              onSelect={setActive}
              onClose={closeFile}
            />
            <FileView
              key={active}
              path={active}
              root={folder}
              themes={codeThemes}
              editor={editor}
            />
          </div>
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  );
}
