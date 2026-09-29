import { FileTabs } from "@/components/app/FileTabs";
import { DiffView } from "@/components/files/DiffView";
import { FileView } from "@/components/files/FileView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import { readDiffTab } from "@/lib/diffTabs";
import type { Settings } from "@/lib/settings";

/** Open file and diff tabs, and the active one's view. */
export function EditorPane({
  folder,
  tabs,
  active,
  codeThemes,
  editor,
  session,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  active: string;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  session: ReturnType<typeof useAgentSession>;
}) {
  const diffTab = readDiffTab(active);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <FileTabs
        files={tabs.files}
        active={active}
        folder={folder}
        onSelect={tabs.activate}
        onClose={tabs.close}
      />
      {diffTab ? (
        <DiffView
          key={active}
          tab={diffTab}
          host={session.host}
          themes={codeThemes}
          editor={editor}
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
