import { X } from "lucide-react";
import { AgentStatusIcon } from "@/components/app/AgentStatusIcon";
import { ConversationTagMenu } from "@/components/sidebar/ConversationTagMenu";
import type { TaggedAgentStatus } from "@/lib/conversations";
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
  onSetTags,
}: {
  agent: TaggedAgentStatus;
  selected: boolean;
  onShow: () => void;
  onClose: () => void;
  onSetTags: (tags: string[]) => void;
}) {
  const title = agent.title || "New conversation";
  const tags = agent.tags ?? [];

  const actionClass =
    "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100";

  return (
    <div
      className={cn(
        "group relative flex min-h-7 items-center rounded-md",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <button
        onClick={onShow}
        aria-current={selected || undefined}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-[13px]"
      >
        <AgentStatusIcon status={agent} />
        <span className="min-w-0 flex-1 truncate text-left">
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {title}
          </span>
          {tags.length > 0 && (
            <span className="mt-0.5 flex min-w-0 gap-1 overflow-hidden">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground ring-1 ring-sidebar-border"
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      <div className="mr-1 flex shrink-0 items-center gap-0.5">
        <ConversationTagMenu
          title={title}
          tags={tags}
          buttonClassName={actionClass}
          onSave={onSetTags}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={`Close ${title}`}
          className={cn(
            "shrink-0 rounded-md p-1 hover:bg-foreground/10",
            actionClass,
          )}
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
