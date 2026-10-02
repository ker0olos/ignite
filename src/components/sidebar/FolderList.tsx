import { Fragment, useState } from "react";
import { ProjectRow } from "@/components/app/ProjectRow";
import { ConversationTagFilter } from "@/components/sidebar/ConversationTagFilter";
import { FolderConversations } from "@/components/sidebar/FolderConversations";
import type { Conversations } from "@/hooks/useConversations";
import type { TaggedAgentStatus } from "@/lib/conversations";
import { sortedByName } from "@/lib/paths";

/** Opening and stopping what runs under a conversation. */
export type ChildActions = {
  /** The shown folder's active tab. */
  activeTab: string | null;
  /** Shows conversation `session` of `cwd` and opens `tab` beside it. */
  onOpenTab: (cwd: string, session: string, tab: string) => void;
  onStopBackground: (session: string, pid: number) => void;
  /** Tab ids of finished rows the user cleared. */
  cleared: string[];
  /** Takes a finished row off the sidebar, closing its tab. */
  onClear: (tab: string) => void;
};

export type ConversationLimit = {
  enabled: boolean;
  max: number;
};

const COLLAPSED_KEY = "collapsed-conversation-folders";

function loadCollapsed(): Record<string, boolean> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_KEY) ?? "{}",
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(
        (entry): entry is [string, boolean] => entry[1] === true,
      ),
    );
  } catch {
    return {};
  }
}

function saveCollapsed(next: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    // Collapsed for now, if not after a reload.
  }
}

/** What the sidebar's folder list needs from the app. */
export type ProjectListProps = {
  childActions: ChildActions;
  folders: string[];
  /** A folder's listed conversations, in the order they were opened. */
  rows: (cwd: string) => TaggedAgentStatus[];
  tags?: string[];
  tagFilter?: string[];
  onToggleTagFilter?: (tag: string) => void;
  onClearTagFilter?: () => void;
  onSetConversationTags?: (session: string, tags: string[]) => void;
  /** The shown folder's shown conversation. */
  shown: string | null;
  conversations: Conversations;
  conversationLimit: ConversationLimit;
  home: string;
  /** Takes a folder off the sidebar, ending its conversations. */
  onDismiss: (path: string) => void;
  /** Opens the command center on a folder's conversations. */
  onHistory: (path: string) => void;
  onOpenFolder: () => void;
};

/**
 * Every folder by name, each with its listed conversations under it. The
 * shown folder's row is selected while it shows a new conversation, else the
 * conversation's is.
 */
export function FolderList({
  folder,
  folders,
  rows,
  shown,
  conversations,
  conversationLimit,
  home,
  onDismiss,
  onHistory,
  childActions,
  tags = [],
  tagFilter = [],
  onToggleTagFilter = () => {},
  onClearTagFilter = () => {},
  onSetConversationTags = () => {},
}: {
  folder: string;
  folders: string[];
  rows: (cwd: string) => TaggedAgentStatus[];
  shown: string | null;
  conversations: Conversations;
  conversationLimit: ConversationLimit;
  home: string;
  onDismiss: (path: string) => void;
  onHistory: (path: string) => void;
  childActions: ChildActions;
  tags?: string[];
  tagFilter?: string[];
  onToggleTagFilter?: (tag: string) => void;
  onClearTagFilter?: () => void;
  onSetConversationTags?: (session: string, tags: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggleLimit = (path: string) =>
    setExpanded((open) => ({ ...open, [path]: !open[path] }));
  const toggleCollapsed = (path: string) =>
    setCollapsed((before) => {
      const next = { ...before, [path]: !before[path] };
      if (!next[path]) delete next[path];
      saveCollapsed(next);
      return next;
    });

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex justify-end">
        <ConversationTagFilter
          tags={tags}
          selected={tagFilter}
          onToggle={onToggleTagFilter}
          onClear={onClearTagFilter}
        />
      </div>
      {sortedByName(folders).map((path) => {
        const isCollapsed = !!collapsed[path];
        return (
          <Fragment key={path}>
            <ProjectRow
              path={path}
              home={home}
              selected={path === folder && (!shown || isCollapsed)}
              collapsed={isCollapsed}
              onToggle={() => toggleCollapsed(path)}
              onNew={() => void conversations.create(path)}
              onHistory={() => onHistory(path)}
              onDismiss={() => onDismiss(path)}
            />
            {!isCollapsed && (
              <FolderConversations
                cwd={path}
                rows={rows(path)}
                shown={path === folder ? shown : null}
                conversations={conversations}
                childActions={childActions}
                tags={tags}
                onSetTags={onSetConversationTags}
                expanded={!!expanded[path]}
                max={conversationLimit.max}
                limited={conversationLimit.enabled}
                onToggle={() => toggleLimit(path)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
