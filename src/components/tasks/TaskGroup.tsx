import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskRow } from "@/components/tasks/TaskRow";
import type { TaskActions } from "@/hooks/useTasks";
import { pageOf, TASK_PAGE, type ShownTask } from "@/lib/tasks";

/** A group's tracked header with its count, then its tasks (a `paged` one's on request); hidden when empty. */
export function TaskGroup({
  label,
  tasks,
  paged,
  openId,
  onToggle,
  actions,
}: {
  label: string;
  tasks: ShownTask[];
  paged?: boolean;
  openId: string | null;
  onToggle: (id: string) => void;
  actions: TaskActions;
}) {
  const [shown, setShown] = useState(0);
  if (tasks.length === 0) return null;
  const rows = paged ? pageOf(tasks, shown) : tasks;
  const more = Math.min(TASK_PAGE, tasks.length - rows.length);
  return (
    <section>
      <h2 className="mb-1 flex gap-2 border-b px-2.5 pt-6 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
        <span className="font-normal">{tasks.length}</span>
      </h2>
      {rows.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          open={task.id === openId}
          onToggle={() => onToggle(task.id)}
          actions={actions}
        />
      ))}
      {more > 0 && (
        <div className="mt-3 flex justify-center">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full px-4 text-[13px] text-muted-foreground"
            onClick={() => setShown(rows.length + TASK_PAGE)}
          >
            {rows.length ? `Show ${more} more` : `Show ${more}`}
            <ChevronDown />
          </Button>
        </div>
      )}
    </section>
  );
}
