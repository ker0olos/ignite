import { ListChecks, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/** Which of a folder's two views shows: its conversation or its tasks. */
export type WorkspaceView = "chat" | "tasks";

const VIEWS = [
  { view: "chat", label: "Chat", Icon: MessageSquare },
  { view: "tasks", label: "Tasks", Icon: ListChecks },
] as const;

/** Chat and Tasks as the sidebar's first rows, styled like its conversation rows. */
export function ViewSwitch({
  view,
  onChange,
}: {
  view: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {VIEWS.map(({ view: v, label, Icon }) => (
        <button
          key={v}
          aria-current={view === v || undefined}
          onClick={() => onChange(v)}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            view === v
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50",
          )}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          {label}
        </button>
      ))}
    </nav>
  );
}
