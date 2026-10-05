import { SubtaskList } from "@/components/tasks/SubtaskList";
import type { Subtask } from "../../../shared/tasks";

/** A task_update call's subtasks after it, as a card with how many are done. */
export function PlanCard({ subtasks }: { subtasks: Subtask[] }) {
  const done = subtasks.filter((s) => s.status === "done").length;
  return (
    <section>
      <h3 className="mb-1.5 flex gap-2 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Subtasks
        <span className="font-normal tabular-nums">
          {done}/{subtasks.length}
        </span>
      </h3>
      <div className="rounded-[10px] border border-border bg-card px-2.5 py-1">
        <SubtaskList subtasks={subtasks} />
      </div>
    </section>
  );
}
