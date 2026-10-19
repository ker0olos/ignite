import { useState, type ReactNode } from "react";
import { DesktopWorkspace } from "@/components/app/DesktopWorkspace";
import { MobileWorkspace } from "@/components/app/MobileWorkspace";
import { ViewSwitch, type WorkspaceView } from "@/components/app/ViewSwitch";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TasksView } from "@/components/tasks/TasksView";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { useTerminalShortcut } from "@/hooks/useTerminalShortcut";
import { useNarrow } from "@/hooks/useNarrow";
import { basename } from "@/lib/paths";
import { OpenTabContext } from "@/hooks/useOpenTab";
import { RunInTerminalContext } from "@/hooks/useRunInTerminal";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { HostClient } from "@/lib/piHost";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
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
  /** The shown conversation (null before a first message, undefined while unknown) and where its files are (null while unknown). */
  shown: { session: string | null | undefined; root: string | null };
  /** The sidecar, whether or not a conversation shows. */
  host: HostClient | null;
};

/**
 * Everything shown for an open folder: sidebar, full-height agent panel, and
 * an editor pane that appears while files are open; files and terminals are the
 * shown conversation's worktree's. Tab state lives in App so the menu (⌘W) can
 * reach it. On a phone, one pane at a time (MobileWorkspace).
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
  shown,
  host,
  ...panel
}: WorkspaceProps) {
  const { active, open: openFile } = tabs;
  const { root } = shown;
  const narrow = useNarrow();
  const [view, setView] = useState<WorkspaceView>("conversation");
  const runIn = useTerminalShortcut(
    host,
    folder,
    root ?? folder,
    shown.session,
    view,
    tabs,
  );
  const sidebar = (
    <Sidebar
      folder={folder}
      root={root}
      treeKey={session.workdir ?? ""}
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
        root={root}
        session={session}
        codeThemes={codeThemes}
        editor={editor}
        modelRouter={modelRouter}
        {...panel}
      />
    );
  const { terminalLabel } = projectList.childActions;
  const pane = {
    folder: root ?? folder,
    tabs,
    codeThemes,
    editor,
    session,
    host,
    terminalLabel,
  };
  return (
    <OpenTabContext.Provider value={openFile}>
      <RunInTerminalContext.Provider value={runIn}>
        {narrow ? (
          <MobileWorkspace
            {...pane}
            sidebar={sidebar}
            agent={agent}
            name={basename(folder)}
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
