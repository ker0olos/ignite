import { BackgroundView } from "@/components/children/BackgroundView";
import { SubagentView } from "@/components/children/SubagentView";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { ChildTab } from "@/lib/childTabs";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";

/** A subagent's or background command's tab. */
export function ChildView({
  tab,
  folder,
  session,
  editor,
  codeThemes,
}: {
  tab: ChildTab;
  folder: string;
  session: ReturnType<typeof useAgentSession>;
  editor: Settings["editor"];
  codeThemes: CodeThemes;
}) {
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
      host={session.host}
      editor={editor}
      codeThemes={codeThemes}
    />
  );
}
