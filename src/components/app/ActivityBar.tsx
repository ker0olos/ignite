import {
  FolderTree,
  GitPullRequest,
  ListChecks,
  MessageSquare,
  Settings,
  SquareTerminal,
} from "lucide-react";
import { ActivityButton } from "@/components/app/ActivityButton";
import type { SideView } from "@/components/app/IdeSideView";
import type { WorkspaceView } from "@/components/app/ViewSwitch";
import { cn } from "@/lib/utils";

/** The IDE layouts' column of views, icons only (VS Code) or labelled (JetBrains); one marked at a time. */
export function ActivityBar({
  jetbrains,
  view,
  side,
  onSide,
  onTasks,
  onNewTerminal,
  onSettings,
}: {
  jetbrains: boolean;
  view: WorkspaceView;
  side: SideView;
  onSide: (side: SideView) => void;
  onTasks: () => void;
  onNewTerminal: (() => void) | null;
  onSettings: () => void;
}) {
  const top = [
    { id: "conversations", label: "Conversations", Icon: MessageSquare },
    { id: "tasks", label: "Tasks", Icon: ListChecks },
    { id: "files", label: "Files", Icon: FolderTree },
    {
      id: "pr",
      label: jetbrains ? "PR" : "Pull requests",
      Icon: GitPullRequest,
    },
  ] as const;
  return (
    <nav
      aria-label="Views"
      className={cn(
        "flex shrink-0 flex-col items-center",
        jetbrains ? "gap-1 px-1 pb-1" : "border-r bg-sidebar",
      )}
    >
      {top.map(({ id, ...item }) => (
        <ActivityButton
          key={id}
          {...item}
          labelled={jetbrains}
          active={view === "tasks" ? id === "tasks" : id === side}
          onClick={() => (id === "tasks" ? onTasks() : onSide(id))}
        />
      ))}
      <div className="flex-1" />
      {onNewTerminal && (
        <ActivityButton
          label={jetbrains ? "Terminal" : "New terminal"}
          Icon={SquareTerminal}
          labelled={jetbrains}
          active={false}
          onClick={onNewTerminal}
        />
      )}
      {!jetbrains && (
        <ActivityButton
          label="Settings"
          Icon={Settings}
          labelled={false}
          active={false}
          onClick={onSettings}
        />
      )}
    </nav>
  );
}
