import type { GitRepoStatus } from "../../../shared/git";
import { GitStatusLinks } from "@/components/agent/GitStatusLinks";
import { ConversationBreadcrumb } from "@/components/app/ConversationBreadcrumb";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { runCounts } from "@/lib/conversations";
import type { HostClient } from "@/lib/piHost";
import { cn } from "@/lib/utils";

/** The IDE layouts' status bar: the composer's git status, and how many conversations work or wait. */
export function StatusBar({
  host,
  folder,
  projectList,
  repos,
  jetbrains,
}: {
  host: HostClient | null;
  folder: string;
  projectList: ProjectListProps;
  repos: GitRepoStatus[];
  jetbrains: boolean;
}) {
  const counts = runCounts(projectList.folders.flatMap(projectList.rows));
  const git = <GitStatusLinks host={host} repos={repos} />;
  return (
    <footer
      className={cn(
        "flex shrink-0 items-center text-xs",
        jetbrains
          ? "h-6.5 gap-4 px-3.5 text-muted-foreground"
          : "h-5.5 gap-3.5 bg-status-bar px-2.5 text-status-bar-foreground [&_button]:text-status-bar-foreground",
      )}
    >
      {jetbrains ? (
        <ConversationBreadcrumb folder={folder} projectList={projectList} />
      ) : (
        git
      )}
      <span className="ml-auto shrink-0">{counts}</span>
      {jetbrains && <div className="flex max-w-[40%] min-w-0">{git}</div>}
    </footer>
  );
}
