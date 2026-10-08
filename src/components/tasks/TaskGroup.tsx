import { useState } from "react";
import { ShowMoreButton } from "@/components/tasks/ShowMoreButton";
import { TaskGroupHeading } from "@/components/tasks/TaskGroupHeading";
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
      <TaskGroupHeading label={label} count={tasks.length} />
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
        <ShowMoreButton
          count={more}
          more={rows.length > 0}
          onClick={() => setShown(rows.length + TASK_PAGE)}
        />
      )}
    </section>
  );
}
