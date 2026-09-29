import { X } from "lucide-react";
import type { AgentStatus } from "../../../shared/hostProtocol";
import { AgentStatusIcon } from "@/components/app/AgentStatusIcon";
import { cn } from "@/lib/utils";

/**
 * One conversation in the sidebar, its title lined up with the folder name
 * above; its status sits in the folder icon's column.
 */
export function ConversationRow({
  agent,
  selected,
  onShow,
  onClose,
}: {
  agent: AgentStatus;
  selected: boolean;
  onShow: () => void;
  onClose: () => void;
}) {
  const title = agent.title || "New conversation";

  return (
    <div
      className={cn(
        "group relative flex h-7 items-center rounded-md",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <button
        onClick={onShow}
        aria-current={selected || undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-[13px]"
      >
        <AgentStatusIcon status={agent} />
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {title}
        </span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${title}`}
        className="mr-1 shrink-0 rounded-md p-1 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        <X className="size-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
