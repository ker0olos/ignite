import { ChevronRight } from "lucide-react";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { conversationTitle } from "@/lib/conversations";
import { basename } from "@/lib/paths";

/** "folder › conversation": VS Code's line under the tabs, JetBrains' status bar. */
export function ConversationBreadcrumb({
  folder,
  projectList,
}: {
  folder: string;
  projectList: ProjectListProps;
}) {
  const row = projectList
    .rows(folder)
    .find((r) => r.session === projectList.shown);
  const title = row && conversationTitle(row);
  return (
    <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
      {basename(folder)}
      {title && (
        <>
          <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </>
      )}
    </span>
  );
}
