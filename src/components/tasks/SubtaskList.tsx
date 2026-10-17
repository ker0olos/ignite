import { SubtaskRow } from "@/components/tasks/SubtaskRow";
import type { Subtask } from "../../../shared/tasks";

/** A task's subtasks in order. */
export function SubtaskList({ subtasks }: { subtasks: Subtask[] }) {
  return (
    <ul className="flex flex-col">
      {/* Titles can repeat, and subtasks have no id. */}
      {subtasks.map((s, i) => (
        <SubtaskRow key={`${i}:${s.title}`} subtask={s} />
      ))}
    </ul>
  );
}
