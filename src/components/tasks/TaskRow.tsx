import { TaskExpanded } from "@/components/tasks/TaskExpanded";
import { TaskMeta } from "@/components/tasks/TaskMeta";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import type { TaskActions } from "@/hooks/useTasks";
import type { ShownTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** One task: a line that opens in place into a card with its notes, files, subtasks and status. */
export function TaskRow({
  task,
  open,
  onToggle,
  actions,
}: {
  task: ShownTask;
  open: boolean;
  onToggle: () => void;
  actions: TaskActions;
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
        <TaskStatusIcon status={task.status} />
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px]",
            task.status === "done" && "text-muted-foreground",
            open ? "text-[14px] font-semibold" : "truncate",
          )}
        >
          {task.title}
        </span>
        {!open && <TaskMeta task={task} />}
      </button>
      {open && <TaskExpanded task={task} actions={actions} />}
    </div>
  );
}
