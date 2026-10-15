import type { Subtask } from "../../../shared/tasks";
import { SubtaskList } from "@/components/tasks/SubtaskList";
import { peekSubtasks } from "@/lib/tasks";

/** A conversation's subtasks where its work is, and how many more are done and to do. */
export function SubtaskPeek({ subtasks }: { subtasks: Subtask[] }) {
  const { shown, moreDone, moreOpen } = peekSubtasks(subtasks);
  const more = [
    moreDone && `${moreDone} more done`,
    moreOpen && `${moreOpen} more to do`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col">
      <SubtaskList subtasks={shown} />
      {more && (
        <span className="pl-[26px] text-xs text-muted-foreground">{more}</span>
      )}
    </div>
  );
}
