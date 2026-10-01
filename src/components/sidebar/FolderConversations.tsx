import { ChevronDown, ChevronRight } from "lucide-react";
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
  expanded,
  max,
  limited,
  onToggle,
}: {
  cwd: string;
  rows: AgentStatus[];
  /** The shown conversation, when this folder is the shown one. */
  shown: string | null;
  conversations: Conversations;
  childActions: ChildActions;
  expanded: boolean;
  max: number;
  limited: boolean;
  onToggle: () => void;
}) {
  const sessions = rows.map((r) => r.session);
  const visible =
    limited && !expanded
      ? rows.filter((r, i) => i < max || r.session === shown)
      : rows;
  const hidden = rows.length - visible.length;
  const canToggle = limited && (expanded ? rows.length > max : hidden > 0);

  return (
    <>
      {visible.map((agent) => (
        <Fragment key={agent.session}>
          <ConversationRow
            agent={agent}
            selected={agent.session === shown}
            onShow={() => void conversations.show(cwd, agent.session)}
            onClose={() =>
              void conversations.close(cwd, agent.session, sessions)
            }
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
      ))}
      {canToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent/50"
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span className="truncate">
            {expanded ? "Show fewer chats" : `Show ${hidden} more chats`}
          </span>
        </button>
      )}
    </>
  );
}
