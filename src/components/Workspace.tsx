import { createElement, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import { AgentPanel } from "@/components/AgentPanel";
import { FileView } from "@/components/FileView";
import { Sidebar } from "@/components/Sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import { fileIcon } from "@/lib/fileIcons";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";

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
  actions,
  banner,
  session,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  hideGitIgnored: boolean;
  actions: ReactNode;
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
          banner={banner}
          selected={active}
          onOpenFile={openFile}
          hideGitIgnored={hideGitIgnored}
        />
      </ResizablePanel>
      <PaneHandle />
      <ResizablePanel id="agent" minSize="320px">
        <div className="flex h-full flex-col">
          <AgentPanel
            folder={folder}
            session={session}
            codeThemes={codeThemes}
            editor={editor}
          />
        </div>
      </ResizablePanel>
      {active && <PaneHandle />}
      {active && (
        <ResizablePanel id="editor" minSize="320px">
          <div className="flex h-full min-w-0 flex-col">
            <div
              data-tauri-drag-region
              className="no-scrollbar flex h-13 shrink-0 items-end gap-0.5 overscroll-contain overflow-x-auto border-b px-2"
            >
              {files.map((path) => (
                <div
                  key={path}
                  title={path.slice(folder.length + 1)}
                  className={cn(
                    "group flex h-9 shrink-0 items-center gap-1.5 rounded-t-md pr-1.5 pl-3 text-[13px]",
                    path === active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <button
                    onClick={() => setActive(path)}
                    className="flex items-center gap-1.5"
                  >
                    {createElement(fileIcon(path), { className: "size-3.5" })}
                    {basename(path)}
                  </button>
                  <button
                    onClick={() => closeFile(path)}
                    aria-label={`Close ${basename(path)}`}
                    className={cn(
                      "rounded p-0.5 hover:bg-foreground/10",
                      path !== active && "invisible group-hover:visible",
                    )}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
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

/** A 1px divider with a wider grab area that lights up on hover, like VS Code's sashes. */
function PaneHandle() {
  return (
    <ResizableHandle className="transition-colors after:w-2 hover:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring" />
  );
}
