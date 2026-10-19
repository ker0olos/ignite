import { useState, type ReactNode } from "react";
import { EditorPane } from "@/components/app/EditorPane";
import { MobileBar } from "@/components/app/MobileBar";
import { MobileDrawer } from "@/components/app/MobileDrawer";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { useTabs } from "@/hooks/useTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import { tabLabel } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";
import type { TerminalLabel } from "@/lib/childTabs";

/**
 * The workspace on a phone: one pane at a time, the conversation or an open
 * file, with the sidebar in a drawer that closes once something is picked.
 */
export function MobileWorkspace({
  folder,
  tabs,
  codeThemes,
  editor,
  session,
  host,
  terminalLabel,
  sidebar,
  agent,
  name,
}: {
  folder: string;
  tabs: ReturnType<typeof useTabs>;
  codeThemes: CodeThemes;
  editor: Settings["editor"];
  session: ReturnType<typeof useAgentSession>;
  host: HostClient | null;
  terminalLabel?: (terminal: string) => TerminalLabel;
  sidebar: ReactNode;
  agent: ReactNode;
  /** The folder's name, the bar's title with no tab open (`folder` is the conversation's worktree). */
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const { active } = tabs;
  // Picking a conversation or a file closes the drawer.
  const [picked, setPicked] = useState([session.session, active]);
  if (picked[0] !== session.session || picked[1] !== active) {
    setPicked([session.session, active]);
    setOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <MobileBar
        title={active ? tabLabel(active, folder, terminalLabel).name : name}
        onMenu={() => setOpen(true)}
        onBack={active ? () => tabs.close(active) : undefined}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {active ? (
          <EditorPane
            folder={folder}
            tabs={tabs}
            dock={tabs.focus}
            active={active}
            codeThemes={codeThemes}
            editor={editor}
            session={session}
            host={host}
            terminalLabel={terminalLabel}
          />
        ) : (
          agent
        )}
      </div>
      <MobileDrawer open={open} onClose={() => setOpen(false)}>
        {sidebar}
      </MobileDrawer>
    </div>
  );
}
