import { AgentLine } from "@/components/tasks/AgentLine";
import { PrLink } from "@/components/tasks/PrLink";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** A done task, with its pull request if it has one: Reopen it or Delete it. */
export function TaskDone({
  pr,
  onReopen,
  onDelete,
}: {
  pr?: string;
  onReopen: () => void;
  onDelete: () => void;
}) {
  return (
    <AgentLine>
      <TaskStatusIcon status="done" />
      <span className="flex-1">Done</span>
      {pr && <PrLink url={pr} />}
      <Button size="sm" variant="ghost" onClick={onReopen}>
        Reopen
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        Delete
      </Button>
    </AgentLine>
  );
}
