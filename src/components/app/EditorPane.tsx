import { FileTabs } from "@/components/app/FileTabs";
import { ChildView } from "@/components/children/ChildView";
import { DiffView } from "@/components/files/DiffView";
import { FileView } from "@/components/files/FileView";
import { ImageDiffView } from "@/components/files/ImageDiffView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { TabDragState } from "@/hooks/useTabDrag";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import { readChildTab } from "@/lib/childTabs";
import { readDiffTab, showsImage } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { Dock } from "@/lib/tabs";
import type { TerminalLabel } from "@/lib/childTabs";

/** A dock's open file, diff, subagent and background tabs, and the active one's view. */
export function EditorPane({
  folder,
  tabs,
  dock,
  drag,
  active,
  codeThemes,
  editor,
  session,
  host,
  terminalLabel,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  dock: Dock;
  drag?: TabDragState;
  active: string;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  session: ReturnType<typeof useAgentSession>;
  /** The sidecar, whether or not a conversation shows. */
  host: HostClient | null;
  terminalLabel?: (terminal: string) => TerminalLabel;
}) {
  const diffTab = readDiffTab(active);
  const childTab = readChildTab(active);
  return (
    <div
      data-tab-dock={dock}
      className="flex h-full min-w-0 flex-col glass:bg-background"
    >
      <FileTabs
        files={tabs[dock].files}
        active={active}
        folder={folder}
        dock={dock}
        drag={drag}
        onSelect={tabs.activate}
        onClose={tabs.close}
        terminalLabel={terminalLabel}
      />
      {childTab ? (
        <ChildView
          key={active}
          tab={childTab}
          {...{ folder, session, host, editor, codeThemes }}
        />
      ) : diffTab && showsImage(diffTab) ? (
        <ImageDiffView key={active} tab={diffTab} host={session.host} />
      ) : diffTab ? (
        <DiffView
          key={active}
          tab={diffTab}
          host={session.host}
          themes={codeThemes}
          editor={editor}
          shown={session.session}
        />
      ) : (
        <FileView
          key={active}
          path={active}
          root={folder}
          themes={codeThemes}
          editor={editor}
        />
      )}
    </div>
  );
}
