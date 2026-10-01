import { Fragment } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { ProjectRow } from "@/components/app/ProjectRow";
import { FolderConversations } from "@/components/sidebar/FolderConversations";
import type { Conversations } from "@/hooks/useConversations";
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

/** What the sidebar's folder list needs from the app. */
export type ProjectListProps = {
  childActions: ChildActions;
  folders: string[];
  /** A folder's listed conversations, in the order they were opened. */
  rows: (cwd: string) => AgentStatus[];
  /** The shown folder's shown conversation. */
  shown: string | null;
  conversations: Conversations;
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
  home,
  onDismiss,
  onHistory,
  childActions,
}: {
  folder: string;
  folders: string[];
  rows: (cwd: string) => AgentStatus[];
  shown: string | null;
  conversations: Conversations;
  home: string;
  onDismiss: (path: string) => void;
  onHistory: (path: string) => void;
  childActions: ChildActions;
}) {
  return (
    <div className="flex flex-col gap-1">
      {sortedByName(folders).map((path) => (
        <Fragment key={path}>
          <ProjectRow
            path={path}
            home={home}
            selected={path === folder && !shown}
            onNew={() => void conversations.create(path)}
            onHistory={() => onHistory(path)}
            onDismiss={() => onDismiss(path)}
          />
          <FolderConversations
            cwd={path}
            rows={rows(path)}
            shown={path === folder ? shown : null}
            conversations={conversations}
            childActions={childActions}
          />
        </Fragment>
      ))}
    </div>
  );
}
