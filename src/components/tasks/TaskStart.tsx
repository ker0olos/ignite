import { Play } from "lucide-react";
import { AgentLine } from "@/components/tasks/AgentLine";
import { Button } from "@/components/ui/button";

/** A task not yet handed over: Delete and Start. */
export function TaskStart({
  error,
  onStart,
  onDelete,
}: {
  error?: string;
  onStart: () => void;
  onDelete: () => void;
}) {
  return (
    <AgentLine>
      {error ? (
        <span className="flex-1 truncate text-[13px] text-destructive">
          {error}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <Button size="sm" variant="ghost" onClick={onDelete}>
        Delete
      </Button>
      <Button size="sm" onClick={onStart}>
        <Play className="fill-current" />
        Start
      </Button>
    </AgentLine>
  );
}
