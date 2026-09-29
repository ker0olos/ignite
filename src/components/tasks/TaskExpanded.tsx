import { SubtaskList } from "@/components/tasks/SubtaskList";
import { TaskAgentCard } from "@/components/tasks/TaskAgentCard";
import { TaskAttachment } from "@/components/tasks/TaskAttachment";
import type { TaskActions } from "@/hooks/useTasks";
import type { ShownTask } from "@/lib/tasks";

/** What an open task row shows under its title: notes, images, subtasks and the status card. */
export function TaskExpanded({
  task,
  actions,
}: {
  task: ShownTask;
  actions: TaskActions;
}) {
  return (
    <div className="flex flex-col gap-3.5 pt-0.5 pr-2.5 pl-9">
      <p className="text-[13px] select-text">
        {task.notes || <span className="text-muted-foreground">Notes</span>}
      </p>
      {task.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {task.images.map((image, i) => (
            <TaskAttachment key={i} image={image} />
          ))}
        </div>
      )}
      {task.subtasks.length > 0 && <SubtaskList subtasks={task.subtasks} />}
      <TaskAgentCard task={task} actions={actions} />
    </div>
  );
}
