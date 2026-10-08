import { TaskDone } from "@/components/tasks/TaskDone";
import { TaskPrReview } from "@/components/tasks/TaskPrReview";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { TaskResume } from "@/components/tasks/TaskResume";
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
  const open = () => task.session && actions.onOpenConversation(task.session);
  const markDone = () => actions.edit(task.id, { done: true });
  switch (task.status) {
    case "todo":
      return (
        <TaskStart
          error={task.error}
          onStart={() => actions.start(task.id)}
          onStartInConversation={() =>
            actions.startInConversation(task.id, actions.onOpenConversation)
          }
          onDelete={() => actions.remove(task.id)}
        />
      );
    case "working":
      return (
        <TaskProgress
          step={workingLine(task)}
          onOpenConversation={open}
          onStop={() => actions.stop(task.id)}
        />
      );
    case "waiting":
      return <TaskWaiting onOpenConversation={open} />;
    case "declined":
    case "review":
      if (task.review?.review) {
        return (
          <TaskPrReview
            review={task.review.review}
            onAnswer={(approved) =>
              actions.answer(task.review!.toolCallId, approved)
            }
            onOpenConversation={open}
          />
        );
      }
      return task.pr ? (
        <TaskReview pr={task.pr} onOpenConversation={open} onDone={markDone} />
      ) : (
        <TaskResume
          declined={task.status === "declined"}
          onResume={(text) => actions.resume(task.id, text)}
          onOpenConversation={open}
          onDone={markDone}
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
