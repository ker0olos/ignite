import { SubtaskRow } from "@/components/tasks/SubtaskRow";
import type { Subtask } from "../../../shared/tasks";

/** A task's subtasks in order. */
export function SubtaskList({ subtasks }: { subtasks: Subtask[] }) {
  return (
    <ul className="flex flex-col">
      {subtasks.map((s) => (
        <SubtaskRow key={s.title} subtask={s} />
      ))}
    </ul>
  );
}
