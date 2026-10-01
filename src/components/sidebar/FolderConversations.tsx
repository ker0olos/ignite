import { Fragment } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { ConversationChildren } from "@/components/sidebar/ConversationChildren";
import { ConversationRow } from "@/components/sidebar/ConversationRow";
import type { ChildActions } from "@/components/sidebar/FolderList";
import type { Conversations } from "@/hooks/useConversations";

/** One folder's listed conversations, the shown one selected, each with its subagents and background commands. */
export function FolderConversations({
  cwd,
  rows,
  shown,
  conversations,
  childActions,
}: {
  cwd: string;
  rows: AgentStatus[];
  /** The shown conversation, when this folder is the shown one. */
  shown: string | null;
  conversations: Conversations;
  childActions: ChildActions;
}) {
  const sessions = rows.map((r) => r.session);
  return rows.map((agent) => (
    <Fragment key={agent.session}>
      <ConversationRow
        agent={agent}
        selected={agent.session === shown}
        onShow={() => void conversations.show(cwd, agent.session)}
        onClose={() => void conversations.close(cwd, agent.session, sessions)}
      />
      <ConversationChildren
        agent={agent}
        activeTab={childActions.activeTab}
        onOpenTab={(tab) => childActions.onOpenTab(cwd, agent.session, tab)}
        cleared={childActions.cleared}
        onClear={childActions.onClear}
        onStopBackground={(pid) =>
          childActions.onStopBackground(agent.session, pid)
        }
      />
    </Fragment>
  ));
}
