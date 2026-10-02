import { ChevronDown, ChevronRight, Folder, Plus } from "lucide-react";
import { ProjectRowActions } from "@/components/sidebar/ProjectRowActions";
import { basename, tildify } from "@/lib/paths";
import { cn } from "@/lib/utils";

/**
 * One folder in the sidebar, its conversations listed under it; clicking it
 * opens a new conversation there. Its full path shows on hover.
 */
export function ProjectRow({
  path,
  home,
  selected,
  collapsed,
  onToggle,
  onNew,
  onHistory,
  onDismiss,
}: {
  path: string;
  home: string;
  selected?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onNew: () => void;
  /** Opens the command center on the folder's conversations. */
  onHistory: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-8 items-center rounded-md",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <button
        onClick={onToggle}
        title={tildify(path, home)}
        aria-current={selected || undefined}
        aria-expanded={!collapsed}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-[13px]"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{basename(path)}</span>
      </button>
      <button
        onClick={onNew}
        aria-label={`New conversation in ${basename(path)}`}
        title="New conversation"
        className="shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        <Plus className="size-3.5 text-muted-foreground" />
      </button>
      <ProjectRowActions
        path={path}
        onHistory={onHistory}
        onDismiss={onDismiss}
      />
    </div>
  );
}
