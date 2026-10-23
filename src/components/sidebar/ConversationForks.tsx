import { GitFork } from "lucide-react";
import { ChildRow } from "@/components/sidebar/ChildRow";
import type { TaggedAgentStatus } from "@/lib/conversations";

/** A conversation's forks under its row, like its subagents; closing one sends its report back. */
export function ConversationForks({
  agent,
  shown,
  shortcuts,
  onShow,
  onClose,
}: {
  agent: TaggedAgentStatus;
  /** Each numbered row's ⌘ digit, by conversation. */
  shortcuts: Map<string, number>;
  /** The shown conversation, when this folder is the shown one. */
  shown: string | null;
  onShow: (session: string) => void;
  onClose: (session: string) => void;
}) {
  return (agent.forks ?? []).map((fork) => (
    <ChildRow
      key={fork.session}
      icon={GitFork}
      name={fork.title || "Fork"}
      running={fork.running}
      waiting={fork.waiting}
      selected={fork.session === shown}
      onOpen={() => onShow(fork.session)}
      onClear={() => onClose(fork.session)}
      clearLabel={`Close ${fork.title || "fork"} and send its report back`}
      shortcut={shortcuts.get(fork.session)}
    />
  ));
}
