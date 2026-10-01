import type { AgentStatus } from "../../../shared/hostProtocol";
import { ChildRow } from "@/components/sidebar/ChildRow";
import { childTabs } from "@/lib/childTabs";

/** A conversation's subagents and background commands under its row, less the finished ones the user cleared. */
export function ConversationChildren({
  agent,
  activeTab,
  cleared,
  onOpenTab,
  onStopBackground,
  onClear,
}: {
  agent: AgentStatus;
  /** The shown folder's active tab, to select its row. */
  activeTab: string | null;
  /** Tab ids of finished rows the user cleared. */
  cleared: string[];
  onOpenTab: (tab: string) => void;
  onStopBackground: (pid: number) => void;
  onClear: (tab: string) => void;
}) {
  return childTabs(agent)
    .filter(({ id, running }) => running || !cleared.includes(id))
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
