import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { ConversationChildren } from "@/components/sidebar/ConversationChildren";
import { ConversationForks } from "@/components/sidebar/ConversationForks";
import { ConversationRow } from "@/components/sidebar/ConversationRow";
import type { ChildActions } from "@/components/sidebar/FolderList";
import type { Conversations } from "@/hooks/useConversations";
import type { ConversationDragState } from "@/hooks/useConversationDrag";
import { FolderTerminals } from "@/components/sidebar/FolderTerminals";
import { terminalsByOwner } from "@/lib/childTabs";
import {
  conversationTitle,
  visibleRows,
  type TaggedAgentStatus,
} from "@/lib/conversations";
import { confirmCloseConversation } from "@/lib/lifecycle";

/** One folder's listed conversations, the shown one selected, each with its subagents, background commands and terminals; then the folder's other terminals. */
export function FolderConversations({
  cwd,
  rows,
  shown,
  conversations,
  childActions,
  tags,
  onSetTags,
  shortcuts,
  expanded,
  max,
  limited,
  onToggle,
  drag,
}: {
  cwd: string;
  rows: TaggedAgentStatus[];
  /** The shown conversation, when this folder is the shown one. */
  shown: string | null;
  conversations: Conversations;
  childActions: ChildActions;
  /** Every tag in use, offered as suggestions. */
  tags: string[];
  onSetTags: (session: string, tags: string[]) => void;
  /** Each numbered row's ⌘ digit, by conversation. */
  shortcuts: Map<string, number>;
  expanded: boolean;
  max: number;
  limited: boolean;
  onToggle: () => void;
  drag: ConversationDragState;
}) {
  const sessions = rows.map((r) => r.session);
  const visible = visibleRows(rows, shown, limited && !expanded, max);
  const hidden = rows.length - visible.length;
  // A row's conversation and its forks: their terminals show under it.
  const family = (r: TaggedAgentStatus) => [
    r.session,
    ...(r.forks ?? []).map((f) => f.session),
  ];
  const terminals = terminalsByOwner(
    childActions.terminals(cwd),
    childActions.terminalOwner,
    visible.flatMap(family),
  );
  const terminalRows = (list: string[]) => (
    <FolderTerminals
      terminals={list}
      label={childActions.terminalLabel}
      shownTabs={childActions.shownTabs}
      onOpen={(terminal) => childActions.onOpenTerminal(cwd, terminal)}
      onStop={childActions.onStopTerminal}
    />
  );
  const canToggle = limited && (expanded ? rows.length > max : hidden > 0);

  return (
    <>
      {visible.map((agent) => (
        <Fragment key={agent.session}>
          <ConversationRow
            agent={agent}
            selected={agent.session === shown}
            shortcut={shortcuts.get(agent.session)}
            onShow={() => void conversations.show(cwd, agent.session)}
            onClose={() =>
              void confirmCloseConversation(conversationTitle(agent)).then(
                async (yes) => {
                  if (yes)
                    await conversations.close(cwd, agent.session, sessions);
                },
              )
            }
            allTags={tags}
            onSetTags={(next) => onSetTags(agent.session, next)}
            drag={drag.row(cwd, agent.session)}
          />
          <ConversationForks
            agent={agent}
            shown={shown}
            shortcuts={shortcuts}
            onShow={(fork) => void conversations.show(cwd, fork)}
            // Closing the shown fork shows its original.
            onClose={(fork) =>
              void conversations.close(cwd, fork, [fork, agent.session])
            }
          />
          <ConversationChildren
            agent={agent}
            shownTabs={childActions.shownTabs}
            onOpenTab={(tab) => childActions.onOpenTab(cwd, agent.session, tab)}
            onClear={childActions.onClear}
            onStopBackground={(pid) =>
              childActions.onStopBackground(agent.session, pid)
            }
          />
          {terminalRows(family(agent).flatMap(terminals.of))}
        </Fragment>
      ))}
      {terminalRows(terminals.rest)}
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
            {expanded
              ? "Show fewer conversations"
              : `Show ${hidden} more conversations`}
          </span>
        </button>
      )}
    </>
  );
}
