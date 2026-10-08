import { MessageSquare, Play } from "lucide-react";
import { AgentLine } from "@/components/tasks/AgentLine";
import { Button } from "@/components/ui/button";

/** A task not yet handed over: Delete, Start in conversation, and Start. */
export function TaskStart({
  error,
  onStart,
  onStartInConversation,
  onDelete,
}: {
  error?: string;
  onStart: () => void;
  onStartInConversation: () => void;
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
      <Button size="sm" variant="outline" onClick={onStartInConversation}>
        <MessageSquare />
        Start in conversation
      </Button>
      <Button size="sm" onClick={onStart}>
        <Play className="fill-current" />
        Start
      </Button>
    </AgentLine>
  );
}
