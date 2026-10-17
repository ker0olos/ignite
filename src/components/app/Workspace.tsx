import { useState, type ReactNode } from "react";
import { DesktopWorkspace } from "@/components/app/DesktopWorkspace";
import { IdeWorkspace, type IdeChrome } from "@/components/app/IdeWorkspace";
import { MobileWorkspace } from "@/components/app/MobileWorkspace";
import { ViewSwitch, type WorkspaceView } from "@/components/app/ViewSwitch";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TasksView } from "@/components/tasks/TasksView";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { useTerminalShortcut } from "@/hooks/useTerminalShortcut";
import { useNarrow } from "@/hooks/useNarrow";
import { OpenTabContext } from "@/hooks/useOpenTab";
import { RunInTerminalContext } from "@/hooks/useRunInTerminal";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { HostClient } from "@/lib/piHost";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Layout, Settings } from "@/lib/settings";
import type { Approval, ModelRouter } from "@/components/agent/Composer";

type WorkspaceProps = {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  hideGitIgnored: boolean;
  showFileTree: boolean;
  showThinking: boolean;
  stickyUserMessages: boolean;
  gitStatus: boolean;
  resizableProjectSplit: boolean;
  approval: Approval;
  modelRouter: ModelRouter;
  actions: ReactNode;
  projectList: ProjectListProps;
  banner?: ReactNode;
  /** Shown at the sidebar's foot. */
  footer?: ReactNode;
  session: ReturnType<typeof useAgentSession>;
  /** The sidecar, whether or not a conversation shows. */
  host: HostClient | null;
  layout: Layout;
  /** What the VS Code and JetBrains layouts' bars reach. */
  chrome: IdeChrome;
};

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
  showFileTree,
  resizableProjectSplit,
  modelRouter,
  actions,
  projectList,
  banner,
  footer,
  session,
  host,
  layout,
  chrome,
  ...panel
}: WorkspaceProps) {
  const { active, open: openFile } = tabs;
  const narrow = useNarrow();
  const [view, setView] = useState<WorkspaceView>("conversation");
  const runIn = useTerminalShortcut(host, folder, view, tabs);
  const sidebar = (
    <Sidebar
      folder={folder}
      actions={actions}
      projectList={projectList}
      banner={banner}
      footer={footer}
      viewSwitch={<ViewSwitch view={view} onChange={setView} />}
      selected={active}
      onOpenFile={openFile}
      hideGitIgnored={hideGitIgnored}
      showTree={showFileTree}
      resizableProjectSplit={resizableProjectSplit}
    />
  );
  const agent =
    view === "tasks" ? (
      <TasksView
        folder={folder}
        host={host}
        agents={projectList.rows(folder)}
        modelRouter={modelRouter}
        onOpenConversation={(s) => {
          projectList.conversations.show(folder, s);
          setView("conversation");
        }}
      />
    ) : (
      <AgentPanel
        host={host}
        folder={folder}
        session={session}
        codeThemes={codeThemes}
        editor={editor}
        modelRouter={modelRouter}
        {...panel}
        // The IDE layouts' status bar shows it instead.
        gitStatus={panel.gitStatus && (narrow || layout === "default")}
      />
    );
  const { terminalCommand } = projectList.childActions;
  const pane = {
    folder,
    tabs,
    codeThemes,
    editor,
    session,
    host,
    terminalCommand,
  };
  return (
    <OpenTabContext.Provider value={openFile}>
      <RunInTerminalContext.Provider value={runIn}>
        {narrow ? (
          <MobileWorkspace {...pane} sidebar={sidebar} agent={agent} />
        ) : layout !== "default" ? (
          <IdeWorkspace
            {...pane}
            jetbrains={layout === "jetbrains"}
            chrome={chrome}
            view={view}
            onView={setView}
            onNewTerminal={runIn && (() => runIn())}
            side={{
              folder,
              projectList,
              host,
              banner,
              footer,
              selected: active,
              onOpenFile: openFile,
              hideGitIgnored,
            }}
            agent={agent}
            gitStatus={panel.gitStatus}
            agentMinWidth={view === "tasks" ? 640 : 320}
          />
        ) : (
          <DesktopWorkspace
            {...pane}
            sidebar={sidebar}
            agent={agent}
            agentMinWidth={view === "tasks" ? 640 : 320}
          />
        )}
      </RunInTerminalContext.Provider>
    </OpenTabContext.Provider>
  );
}
