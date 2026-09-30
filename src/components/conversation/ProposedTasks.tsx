import { ProposedTaskRow } from "@/components/conversation/ProposedTaskRow";
import type { ProposedTask } from "../../../shared/tasks";

/** The tasks task_add would add: a count, then one divided list of rows. */
export function ProposedTasks({ tasks }: { tasks: ProposedTask[] }) {
  return (
    <section>
      <h3 className="mb-1.5 flex gap-2 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        New tasks
        <span className="font-normal">{tasks.length}</span>
      </h3>
      <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
        {tasks.map((task, i) => (
          <ProposedTaskRow key={i} task={task} />
        ))}
      </ul>
    </section>
  );
}
