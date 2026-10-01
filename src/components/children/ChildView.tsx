import { BackgroundView } from "@/components/children/BackgroundView";
import { SubagentView } from "@/components/children/SubagentView";
import { TerminalView } from "@/components/children/TerminalView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { ChildTab } from "@/lib/childTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import type { HostClient } from "@/lib/piHost";
import type { Settings } from "@/lib/settings";

/** A subagent's, background command's or terminal's tab. */
export function ChildView({
  tab,
  folder,
  session,
  host,
  editor,
  codeThemes,
}: {
  tab: ChildTab;
  folder: string;
  session: ReturnType<typeof useAgentSession>;
  /** The sidecar, whether or not a conversation shows. */
  host: HostClient | null;
  editor: Settings["editor"];
  codeThemes: CodeThemes;
}) {
  if (tab.kind === "terminal") {
    return <TerminalView terminal={tab.terminal} host={host} editor={editor} />;
  }
  return tab.kind === "agent" ? (
    <SubagentView
      owner={tab.session}
      id={tab.id}
      model={tab.model}
      {...{ folder, session, editor, codeThemes }}
    />
  ) : (
    <BackgroundView
      session={tab.session}
      pid={tab.pid}
      command={tab.command}
      host={host}
      editor={editor}
    />
  );
}
