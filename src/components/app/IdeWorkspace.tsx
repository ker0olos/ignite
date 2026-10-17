import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ActivityBar } from "@/components/app/ActivityBar";
import { IdeMain } from "@/components/app/IdeMain";
import { DesktopWorkspace } from "@/components/app/DesktopWorkspace";
import { IdeSideView, type SideView } from "@/components/app/IdeSideView";
import { IdeTopBar } from "@/components/app/IdeTopBar";
import { StatusBar } from "@/components/app/StatusBar";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import { useGitStatus } from "@/hooks/useGitStatus";
import { useHiddenTabs } from "@/hooks/useHiddenTabs";
import type { MenuEntry } from "@/lib/inAppMenu";
import { cn } from "@/lib/utils";

/** What the IDE layouts' bars reach in the rest of the app. */
export type IdeChrome = {
  menu: MenuEntry[];
  onSettings: () => void;
  onSearch: () => void;
  onSelectFolder: (folder: string) => void;
};

/** The VS Code and JetBrains layouts: DesktopWorkspace's panes with a top bar, activity bar, tab strip and status bar. */
export function IdeWorkspace({
  jetbrains,
  chrome,
  view,
  onView,
  onNewTerminal,
  side: sideProps,
  agent,
  gitStatus,
  ...workspace
}: Omit<ComponentProps<typeof DesktopWorkspace>, "sidebar"> & {
  jetbrains: boolean;
  chrome: IdeChrome;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
  onNewTerminal: (() => void) | null;
  side: Omit<
    ComponentProps<typeof IdeSideView>,
    "view" | "jetbrains" | "repos" | "gitStatus"
  >;
  agent: ReactNode;
  /** The status bar shows git status in place of the composer. */
  gitStatus: boolean;
}) {
  const [side, setSide] = useState<SideView>("conversations");
  const { folder, host } = sideProps;
  const { tabs } = workspace;
  const { hidden, hide, reopen } = useHiddenTabs();
  // A conversation shown or started from the side panel or top bar comes to the front, its tab reopened.
  const front = () => {
    tabs.activate(null);
    onView("conversation");
  };
  const { conversations } = sideProps.projectList;
  const projectList = {
    ...sideProps.projectList,
    conversations: {
      ...conversations,
      show: (cwd: string, session: string) => {
        front();
        reopen(session);
        conversations.show(cwd, session);
      },
      create: (cwd: string) => {
        front();
        conversations.create(cwd);
      },
    },
  };
  // Something opened while Tasks shows (a file, a terminal) shows the tabs again.
  useEffect(() => {
    if (tabs.active) onView("conversation");
  }, [tabs.active, onView]);
  const repos = useGitStatus(host, gitStatus ? projectList.shown : null);
  // Tasks takes the main area; any side view brings the conversation back.
  const show = (next: SideView) => {
    setSide(next);
    onView("conversation");
  };
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        jetbrains ? "ide-islands" : "ide-vscode",
      )}
    >
      <IdeTopBar
        jetbrains={jetbrains}
        folder={folder}
        projectList={projectList}
        chrome={chrome}
      />
      <div className="flex min-h-0 flex-1">
        <ActivityBar
          jetbrains={jetbrains}
          view={view}
          side={side}
          onSide={show}
          onTasks={() => onView(view === "tasks" ? "conversation" : "tasks")}
          onNewTerminal={onNewTerminal}
          onSettings={chrome.onSettings}
        />
        <DesktopWorkspace
          {...workspace}
          // The editor's tabs share the main area's strip, so its own pane never opens.
          tabs={{ ...tabs, active: null }}
          glass={false}
          sidebar={
            <IdeSideView
              {...sideProps}
              projectList={projectList}
              view={side}
              jetbrains={jetbrains}
              repos={repos}
              gitStatus={gitStatus}
            />
          }
          agent={
            <IdeMain
              jetbrains={jetbrains}
              view={view}
              projectList={projectList}
              hidden={hidden}
              onHide={hide}
              agent={agent}
              pane={workspace}
            />
          }
        />
      </div>
      <StatusBar
        host={host}
        folder={folder}
        projectList={projectList}
        repos={repos}
        jetbrains={jetbrains}
      />
    </div>
  );
}
