import { Plus } from "lucide-react";
import type { ProjectListProps } from "@/components/sidebar/FolderList";
import { OpenFolderButton } from "@/components/sidebar/OpenFolderButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The side panel's title: VS Code's small uppercase one with its buttons beside
 * it, or JetBrains' plain one (its Open folder is in the top bar's folder menu).
 */
export function IdeSideHeader({
  title,
  folder,
  projectList,
  conversations,
  jetbrains,
}: {
  title: string;
  folder: string;
  projectList: ProjectListProps;
  /** The conversations view, which gets the folder and conversation buttons. */
  conversations: boolean;
  jetbrains: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 pr-2",
        jetbrains ? "h-9.5 pl-3.5" : "h-8.75 pl-5",
      )}
    >
      <span
        className={cn(
          "flex-1 truncate",
          jetbrains
            ? "text-[13px] font-semibold"
            : "text-[11px] tracking-wide text-muted-foreground uppercase",
        )}
      >
        {title}
      </span>
      {conversations && !jetbrains && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            onClick={() => projectList.conversations.create(folder)}
          >
            <Plus />
          </Button>
          <OpenFolderButton onClick={projectList.onOpenFolder} />
        </>
      )}
    </div>
  );
}
