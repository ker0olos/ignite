import { FileTabs } from "@/components/app/FileTabs";
import { ChildView } from "@/components/children/ChildView";
import { DiffView } from "@/components/files/DiffView";
import { FileView } from "@/components/files/FileView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import { readChildTab } from "@/lib/childTabs";
import { readDiffTab } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { TerminalLabel } from "@/lib/childTabs";

/** Open file, diff, subagent and background tabs, and the active one's view. */
export function EditorPane({
  folder,
  tabs,
  active,
  codeThemes,
  editor,
  session,
  host,
  terminalLabel,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
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
    <div className="flex h-full min-w-0 flex-col glass:bg-background">
      <FileTabs
        files={tabs.files}
        active={active}
        folder={folder}
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
      ) : diffTab ? (
        <DiffView
          key={active}
          tab={diffTab}
          host={session.host}
          themes={codeThemes}
          editor={editor}
          target={{ shown: session.session, show: session.show }}
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
