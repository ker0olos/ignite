import type { AgentStatus } from "../../../shared/hostProtocol";
import { ChildRow } from "@/components/sidebar/ChildRow";
import { childTabs } from "@/lib/childTabs";

/** A conversation's subagents and background commands under its row, while they run; a finished one only while its tab is active. */
export function ConversationChildren({
  agent,
  activeTab,
  onOpenTab,
  onStopBackground,
  onClear,
}: {
  agent: AgentStatus;
  /** The shown folder's active tab, to select its row. */
  activeTab: string | null;
  onOpenTab: (tab: string) => void;
  onStopBackground: (pid: number) => void;
  onClear: (tab: string) => void;
}) {
  return childTabs(agent)
    .filter(({ id, running }) => running || id === activeTab)
    .map(({ id, tab, label, running }) => (
      <ChildRow
        key={id}
        icon={label.icon}
        name={label.name}
        detail={tab.kind === "agent" ? label.detail : undefined}
        running={running}
        selected={id === activeTab}
        onOpen={() => onOpenTab(id)}
        onStop={
          tab.kind === "background"
            ? () => onStopBackground(tab.pid)
            : undefined
        }
        onClear={() => onClear(id)}
      />
    ));
}
