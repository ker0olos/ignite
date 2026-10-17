import type { ComponentProps, ReactNode } from "react";
import { ConversationBreadcrumb } from "@/components/app/ConversationBreadcrumb";
import type { DesktopWorkspace } from "@/components/app/DesktopWorkspace";
import { EditorPane } from "@/components/app/EditorPane";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import { WorkspaceTabs } from "@/components/app/WorkspaceTabs";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIdeTabs } from "@/hooks/useIdeTabs";
import { cn } from "@/lib/utils";

/** The IDE layouts' main area: the tab strip over its front tab, and the terminal panel below. */
export function IdeMain({
  jetbrains,
  view,
  projectList,
  hidden,
  onHide,
  agent,
  pane,
}: {
  jetbrains: boolean;
  view: WorkspaceView;
  projectList: ProjectListProps;
  /** Conversations whose tabs were closed. */
  hidden: string[];
  onHide: (session: string) => void;
  agent: ReactNode;
  pane: Omit<ComponentProps<typeof DesktopWorkspace>, "sidebar" | "agent">;
}) {
  const { tabs, folder } = pane;
  const placed = useIdeTabs(tabs);
  const conversation = view === "conversation";
  const front = conversation ? placed.front : null;
  return (
    // One tree whether or not the panel shows, so the conversation never remounts.
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel id="main" minSize="160px">
        <div data-pane="main" className="flex h-full flex-col">
          {conversation && (
            <WorkspaceTabs
              folder={folder}
              projectList={projectList}
              tabs={tabs}
              files={placed.strip}
              front={front}
              hidden={hidden}
              onHide={onHide}
              terminalLabel={pane.terminalLabel}
            />
          )}
          {conversation && !jetbrains && !front && (
            <div className="flex h-5.5 shrink-0 items-center px-4">
              <ConversationBreadcrumb
                folder={folder}
                projectList={projectList}
              />
            </div>
          )}
          {/* Invisible, not display: none, which would lose its scroll place. */}
          <div className="relative min-h-0 flex-1">
            <div
              inert={!!front}
              className={cn(
                "absolute inset-0 flex flex-col",
                front && "invisible",
              )}
            >
              {agent}
            </div>
            {front && (
              <div className="absolute inset-0">
                <EditorPane {...pane} active={front} strip={false} />
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>
      {placed.panel && <ResizableHandle />}
      {placed.panel && (
        <ResizablePanel id="terminal" defaultSize="30%" minSize="80px">
          <div data-pane="terminal" className="h-full">
            <EditorPane
              {...pane}
              tabs={{
                ...tabs,
                files: placed.terminals,
                // A closed terminal leaves the main area as it was.
                close: (tab) => {
                  tabs.close(tab);
                  tabs.activate(placed.kept);
                },
              }}
              active={placed.panel}
            />
          </div>
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  );
}
