import { Folder } from "lucide-react";
import type {
  SavedSession,
  SessionDetails,
} from "../../../shared/conversations";
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
  onNew,
  history,
  details,
  onShowSession,
  onDismiss,
}: {
  path: string;
  home: string;
  selected?: boolean;
  onNew: () => void;
  history: () => Promise<SavedSession[]>;
  details: (session: string) => Promise<SessionDetails | null>;
  onShowSession: (session: string) => void;
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
        onClick={onNew}
        title={tildify(path, home)}
        aria-current={selected || undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-[13px]"
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{basename(path)}</span>
      </button>
      <ProjectRowActions
        path={path}
        history={history}
        details={details}
        onShowSession={onShowSession}
        onDismiss={onDismiss}
      />
    </div>
  );
}
