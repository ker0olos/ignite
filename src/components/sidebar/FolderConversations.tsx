import type { AgentStatus } from "../../../shared/hostProtocol";
import { ConversationRow } from "@/components/sidebar/ConversationRow";
import type { Conversations } from "@/hooks/useConversations";

/** One folder's listed conversations, the shown one selected. */
export function FolderConversations({
  cwd,
  rows,
  shown,
  conversations,
}: {
  cwd: string;
  rows: AgentStatus[];
  /** The shown conversation, when this folder is the shown one. */
  shown: string | null;
  conversations: Conversations;
}) {
  const sessions = rows.map((r) => r.session);
  return rows.map((agent) => (
    <ConversationRow
      key={agent.session}
      agent={agent}
      selected={agent.session === shown}
      onShow={() => void conversations.show(cwd, agent.session)}
      onClose={() => void conversations.close(cwd, agent.session, sessions)}
    />
  ));
}
