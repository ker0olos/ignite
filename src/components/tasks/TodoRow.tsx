import { MessageSquare, Plus } from "lucide-react";
import type { TodoItem } from "../../../shared/tasks";
import { Button } from "@/components/ui/button";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { cn } from "@/lib/utils";

/** A .todo item: a line naming the folder it came from, opening in place to its section, description and actions (Delete removes it from the file). */
export function TodoRow({
  item,
  open,
  onToggle,
  onAdd,
  onStartInConversation,
  onDelete,
}: {
  item: TodoItem;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onStartInConversation: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] transition-[background-color,box-shadow]",
        open
          ? "-mx-2 my-2.5 bg-card px-2 pt-1.5 pb-3.5 shadow-md ring-1 ring-border"
          : "hover:bg-accent",
      )}
    >
      <button
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-[38px] w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <TaskStatusIcon status="todo" dashed />
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px]",
            open ? "text-[14px] font-semibold" : "truncate",
          )}
        >
          {item.title}
        </span>
        {item.folder && (
          <span className="max-w-40 shrink-0 truncate text-[11.5px] text-muted-foreground">
            {item.folder}
          </span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-3 pt-0.5 pr-2.5 pl-9">
          {item.section && (
            <p className="text-[11.5px] text-muted-foreground">
              {item.section}
            </p>
          )}
          {item.notes && (
            <p className="text-[13px] whitespace-pre-wrap select-text">
              {item.notes}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onDelete}>
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={onStartInConversation}>
              <MessageSquare />
              Start in conversation
            </Button>
            <Button size="sm" onClick={onAdd}>
              <Plus />
              Add to tasks
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
