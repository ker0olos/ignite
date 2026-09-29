import { GitPullRequest, ListChecks, Paperclip } from "lucide-react";
import {
  ago,
  doneCount,
  prLabel,
  workingLine,
  type ShownTask,
} from "@/lib/tasks";

/** A closed row's right side: the agent's step or pull request, subtasks done, images, and last update. */
export function TaskMeta({ task }: { task: ShownTask }) {
  return (
    <span className="flex shrink-0 items-center gap-3 text-[11.5px] text-muted-foreground tabular-nums">
      {task.status === "working" && (
        <span className="max-w-64 truncate font-mono text-xs">
          {workingLine(task)}
        </span>
      )}
      {task.pr && (
        <span className="flex items-center gap-1 text-success">
          <GitPullRequest className="size-3" />
          {prLabel(task.pr)}
        </span>
      )}
      {task.subtasks.length > 0 && (
        <span className="flex items-center gap-1">
          <ListChecks className="size-3" />
          {doneCount(task)}/{task.subtasks.length}
        </span>
      )}
      {task.images.length > 0 && (
        <span className="flex items-center gap-1">
          <Paperclip className="size-3" />
          {task.images.length}
        </span>
      )}
      <span>{ago(task.updated)}</span>
    </span>
  );
}
