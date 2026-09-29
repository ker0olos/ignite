import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Kbd } from "@/components/agent/Kbd";
import { shortcut } from "@/lib/approvalKeys";

/** The row atop the list that opens the new-task sheet. */
export function NewTaskRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[38px] w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[13px] text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <TaskStatusIcon status="todo" dashed />
      <span className="flex-1">New task…</span>
      <Kbd>{shortcut("N")}</Kbd>
    </button>
  );
}
