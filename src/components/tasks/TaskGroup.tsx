import { TaskRow } from "@/components/tasks/TaskRow";
import type { TaskActions } from "@/hooks/useTasks";
import type { ShownTask } from "@/lib/tasks";

/** A group's tracked header with its count, then its tasks; hidden when empty. */
export function TaskGroup({
  label,
  tasks,
  openId,
  onToggle,
  actions,
}: {
  label: string;
  tasks: ShownTask[];
  openId: string | null;
  onToggle: (id: string) => void;
  actions: TaskActions;
}) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1 flex gap-2 border-b px-2.5 pt-6 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
        <span className="font-normal">{tasks.length}</span>
      </h2>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          open={task.id === openId}
          onToggle={() => onToggle(task.id)}
          actions={actions}
        />
      ))}
    </section>
  );
}
