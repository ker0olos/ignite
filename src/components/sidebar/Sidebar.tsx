import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { FileTree } from "@/components/files/FileTree";
import { OpenFolderButton } from "@/components/sidebar/OpenFolderButton";
import {
  ProjectList,
  type ProjectListProps,
} from "@/components/sidebar/ProjectList";
import { Button } from "@/components/ui/button";
import { basename } from "@/lib/paths";
import { cn } from "@/lib/utils";

/** Left column: title-bar strip beside the traffic lights, then the file tree or project list. */
export function Sidebar({
  folder,
  actions,
  banner,
  projectList,
  ...treeProps
}: Omit<ComponentProps<typeof FileTree>, "root"> & {
  folder: string;
  actions: ReactNode;
  /** Shown above the folder name, e.g. a sign-in warning. */
  banner?: ReactNode;
  projectList: ProjectListProps;
}) {
  const [mode, setMode] = useState<"files" | "projects">("files");
  const showingProjects = mode === "projects";

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* The name sits beside the traffic lights and wraps below them when it doesn't fit. */}
      <div className="relative shrink-0">
        <div
          data-tauri-drag-region
          className={cn(
            "flex flex-wrap items-center pb-1",
            showingProjects ? "pr-20" : "pr-10",
          )}
        >
          {/* Room for the traffic lights; Windows has none. */}
          <div
            data-tauri-drag-region
            className="h-13 w-20 shrink-0 in-[.windows]:w-2"
          />
          {!showingProjects && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Projects"
              title="Projects"
              onClick={() => setMode("projects")}
            >
              <ChevronLeft />
            </Button>
          )}
          <span
            data-tauri-drag-region
            className="min-w-0 truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {showingProjects ? "Projects" : basename(folder)}
          </span>
        </div>
        <div className="absolute top-0 right-2 flex h-13 items-center gap-1">
          {showingProjects && (
            <OpenFolderButton onClick={projectList.onOpenFolder} />
          )}
          {actions}
        </div>
      </div>
      {banner}
      <nav className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
        <div className="always-bounce px-2 pb-2">
          {showingProjects ? (
            <ProjectList
              folder={folder}
              onShowFiles={() => setMode("files")}
              {...projectList}
            />
          ) : (
            <FileTree root={folder} {...treeProps} />
          )}
        </div>
      </nav>
    </aside>
  );
}
