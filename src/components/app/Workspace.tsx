import type { ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { EditorPane } from "@/components/app/EditorPane";
import { MobileWorkspace } from "@/components/app/MobileWorkspace";
import { PaneHandle } from "@/components/app/PaneHandle";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useNarrow } from "@/hooks/useNarrow";
import { OpenTabContext } from "@/hooks/useOpenTab";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import type { Approval } from "@/components/agent/Composer";

/**
 * Everything shown for an open folder: sidebar, full-height agent panel, and
 * an editor pane that appears while files are open. Tab state lives in App so
 * the menu (⌘W) can reach it. On a phone, one pane at a time (MobileWorkspace).
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
  const { active } = tabs;
  const openFile = tabs.open;
  const narrow = useNarrow();

  // Pane sizes persist, saved separately for with and without the editor.
  const layout = useDefaultLayout({
    id: "workspace",
    panelIds: active ? ["sidebar", "agent", "editor"] : ["sidebar", "agent"],
    storage: localStorage,
  });

  const sidebar = (
    <Sidebar
      folder={folder}
      actions={actions}
      projectList={projectList}
      banner={banner}
      selected={active}
      onOpenFile={openFile}
      hideGitIgnored={hideGitIgnored}
    />
  );
  const agent = (
    <AgentPanel
      folder={folder}
      session={session}
      codeThemes={codeThemes}
      editor={editor}
      showThinking={showThinking}
      approval={approval}
    />
  );

  if (narrow) {
    return (
      <OpenTabContext.Provider value={openFile}>
        <MobileWorkspace
          {...{ folder, tabs, codeThemes, editor, session, sidebar, agent }}
        />
      </OpenTabContext.Provider>
    );
  }

  return (
    <OpenTabContext.Provider value={openFile}>
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
          {sidebar}
        </ResizablePanel>
        <PaneHandle />
        <ResizablePanel id="agent" minSize="320px">
          <div className="relative flex h-full flex-col">{agent}</div>
        </ResizablePanel>
        {active && <PaneHandle />}
        {active && (
          <ResizablePanel id="editor" minSize="320px">
            <EditorPane
              {...{ folder, tabs, active, codeThemes, editor, session }}
            />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </OpenTabContext.Provider>
  );
}
