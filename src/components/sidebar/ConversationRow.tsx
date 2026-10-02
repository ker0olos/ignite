import { X } from "lucide-react";
import { AgentStatusIcon } from "@/components/app/AgentStatusIcon";
import { ConversationTagMenu } from "@/components/sidebar/ConversationTagMenu";
import { TagChip } from "@/components/sidebar/TagChip";
import type { TaggedAgentStatus } from "@/lib/conversations";
import { cn } from "@/lib/utils";

const ROW_TAGS = 2;

/**
 * One conversation in the sidebar, its title lined up with the folder name
 * above; its status sits in the folder icon's column.
 */
export function ConversationRow({
  agent,
  selected,
  allTags = [],
  onShow,
  onClose,
  onSetTags,
}: {
  agent: TaggedAgentStatus;
  /** Every tag in use, offered as suggestions. */
  allTags?: string[];
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
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {title}
        </span>
        {tags.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {tags.slice(0, ROW_TAGS).map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            {tags.length > ROW_TAGS && (
              <span className="text-[11px] text-muted-foreground">
                +{tags.length - ROW_TAGS}
              </span>
            )}
          </span>
        )}
      </button>
      <div className="mr-1 flex shrink-0 items-center gap-0.5">
        <ConversationTagMenu
          title={title}
          tags={tags}
          allTags={allTags}
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
