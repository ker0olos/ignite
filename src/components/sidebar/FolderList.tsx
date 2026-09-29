import { Fragment } from "react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { ProjectRow } from "@/components/app/ProjectRow";
import { FolderConversations } from "@/components/sidebar/FolderConversations";
import type { Conversations } from "@/hooks/useConversations";
import { sortedByName } from "@/lib/paths";

/** What the sidebar's folder list needs from the app. */
export type ProjectListProps = {
  folders: string[];
  /** A folder's listed conversations, in the order they were opened. */
  rows: (cwd: string) => AgentStatus[];
  /** The shown folder's shown conversation. */
  shown: string | null;
  conversations: Conversations;
  home: string;
  /** Takes a folder off the sidebar, ending its conversations. */
  onDismiss: (path: string) => void;
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
}: {
  folder: string;
  folders: string[];
  rows: (cwd: string) => AgentStatus[];
  shown: string | null;
  conversations: Conversations;
  home: string;
  onDismiss: (path: string) => void;
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
            history={() => conversations.history(path)}
            onShowSession={(id) => void conversations.show(path, id)}
            onDismiss={() => onDismiss(path)}
          />
          <FolderConversations
            cwd={path}
            rows={rows(path)}
            shown={path === folder ? shown : null}
            conversations={conversations}
          />
        </Fragment>
      ))}
    </div>
  );
}
