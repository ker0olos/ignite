import type { ComponentProps, ReactNode } from "react";
import type { GitRepoStatus } from "../../../shared/git";
import { IdeSideHeader } from "@/components/app/IdeSideHeader";
import { PullRequestsView } from "@/components/app/PullRequestsView";
import { FileTree } from "@/components/files/FileTree";
import {
  FolderList,
  type ProjectListProps,
} from "@/components/sidebar/FolderList";
import type { HostClient } from "@/lib/piHost";
import { cn } from "@/lib/utils";

/** What the IDE layouts' side panel shows, one at a time. */
export type SideView = "conversations" | "files" | "pr";

const TITLES: Record<SideView, string> = {
  conversations: "Conversations",
  files: "Files",
  pr: "Pull requests",
};

/** The VS Code and JetBrains layouts' side panel: the sidebar's folders, its file tree, or the PR view. */
export function IdeSideView({
  view,
  folder,
  projectList,
  host,
  banner,
  footer,
  jetbrains,
  repos,
  gitStatus,
  ...treeProps
}: Omit<ComponentProps<typeof FileTree>, "root"> & {
  view: SideView;
  folder: string;
  projectList: ProjectListProps;
  host: HostClient | null;
  banner?: ReactNode;
  footer?: ReactNode;
  jetbrains: boolean;
  repos: GitRepoStatus[];
  gitStatus: boolean;
}) {
  return (
    <aside
      data-pane="side"
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
    >
      <IdeSideHeader
        title={TITLES[view]}
        folder={folder}
        projectList={projectList}
        conversations={view === "conversations"}
        jetbrains={jetbrains}
      />
      {banner}
      <div
        className={cn(
          "always-bounce min-h-0 flex-1 overflow-y-auto pb-2",
          jetbrains ? "px-1.5" : "px-0",
        )}
      >
        {view === "conversations" && (
          <FolderList
            folder={folder}
            {...projectList}
            // JetBrains' lists the folder its top bar picks; VS Code's every folder.
            folders={jetbrains ? [folder] : projectList.folders}
          />
        )}
        {view === "files" && <FileTree root={folder} {...treeProps} />}
        {view === "pr" && (
          <PullRequestsView host={host} repos={repos} gitStatus={gitStatus} />
        )}
      </div>
      {footer}
    </aside>
  );
}
