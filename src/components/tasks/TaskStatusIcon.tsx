import { Check } from "lucide-react";
import type { TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const MARKS: Record<TaskStatus, string> = {
  todo: "border-[1.5px] border-muted-foreground/60",
  working: "animate-spin border-[1.5px] border-warning border-r-transparent",
  waiting: "bg-warning text-[10px] leading-none font-extrabold text-background",
  review: "bg-success",
  done: "bg-muted-foreground/55",
};

/** A task's or subtask's status mark: ring, spinner, or a filled dot with its glyph. */
export function TaskStatusIcon({
  status,
  dashed,
}: {
  status: TaskStatus;
  dashed?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-3.5 shrink-0 place-items-center rounded-full",
        MARKS[status],
        dashed && "border-dashed",
      )}
    >
      {status === "waiting" && "!"}
      {status === "review" && (
        <span className="size-[5px] rounded-full bg-background" />
      )}
      {status === "done" && (
        <Check className="size-2.5 text-background" strokeWidth={4} />
      )}
    </span>
  );
}
