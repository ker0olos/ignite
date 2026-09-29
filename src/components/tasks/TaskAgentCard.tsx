import { TaskDone } from "@/components/tasks/TaskDone";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { TaskReview } from "@/components/tasks/TaskReview";
import { TaskStart } from "@/components/tasks/TaskStart";
import { TaskWaiting } from "@/components/tasks/TaskWaiting";
import type { TaskActions } from "@/hooks/useTasks";
import { workingLine, type ShownTask } from "@/lib/tasks";

/** Where the agent stands on a task, and what the user can do about it. */
export function TaskAgentCard({
  task,
  actions,
}: {
  task: ShownTask;
  actions: TaskActions;
}) {
  const open = () => task.session && actions.onOpenChat(task.session);
  switch (task.status) {
    case "todo":
      return (
        <TaskStart
          onStart={() => actions.start(task.id)}
          onDelete={() => actions.remove(task.id)}
        />
      );
    case "working":
      return (
        <TaskProgress
          step={workingLine(task)}
          onOpenChat={open}
          onStop={() => actions.stop(task.id)}
        />
      );
    case "waiting":
      return <TaskWaiting onOpenChat={open} />;
    case "review":
      return (
        <TaskReview
          pr={task.pr}
          onOpenChat={open}
          onDone={() => actions.edit(task.id, { done: true })}
        />
      );
    case "done":
      return (
        <TaskDone
          pr={task.pr}
          onReopen={() => actions.edit(task.id, { done: false })}
          onDelete={() => actions.remove(task.id)}
        />
      );
  }
}
