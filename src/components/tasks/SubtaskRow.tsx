import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import type { Subtask } from "../../../shared/tasks";
import { cn } from "@/lib/utils";

/** One subtask: its status and title, struck through once done. */
export function SubtaskRow({ subtask }: { subtask: Subtask }) {
  return (
    <li className="flex h-7 items-center gap-2.5">
      <TaskStatusIcon status={subtask.status} />
      <span
        className={cn(
          "truncate text-[13px]",
          subtask.status === "done" &&
            "text-muted-foreground line-through decoration-muted-foreground/40",
        )}
      >
        {subtask.title}
      </span>
      {subtask.status === "working" && (
        <span className="ml-auto text-[11px] text-warning">now</span>
      )}
    </li>
  );
}
