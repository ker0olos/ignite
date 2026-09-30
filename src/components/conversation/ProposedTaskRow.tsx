import { ListChecks } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SubtaskRow } from "@/components/tasks/SubtaskRow";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { splitNotes } from "@/lib/noteLinks";
import type { ProposedTask } from "../../../shared/tasks";

/** One task task_add would add, drawn like a task that hasn't started. */
export function ProposedTaskRow({ task }: { task: ProposedTask }) {
  const { links, text } = splitNotes(task.notes ?? "");
  const subtasks = task.subtasks ?? [];
  return (
    <li className="px-2.5 py-1">
      <div className="flex h-[34px] items-center gap-3">
        <TaskStatusIcon status="todo" />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {task.title}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-[11.5px] text-muted-foreground tabular-nums">
          {links.map((l) => (
            <button
              key={l.url}
              type="button"
              title={l.url}
              onClick={() => void openUrl(l.url).catch(() => {})}
              className="rounded-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {l.label}
            </button>
          ))}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks className="size-3" />
              0/{subtasks.length}
            </span>
          )}
        </span>
      </div>
      {(text || subtasks.length > 0) && (
        <div className="-mt-0.5 flex flex-col pb-1.5 pl-[26px]">
          {text && (
            <p className="line-clamp-3 pb-1 text-[13px] whitespace-pre-wrap text-muted-foreground">
              {text}
            </p>
          )}
          <ul className="flex flex-col">
            {subtasks.map((title) => (
              <SubtaskRow key={title} subtask={{ title, status: "todo" }} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
