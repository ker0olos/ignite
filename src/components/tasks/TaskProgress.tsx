import { Square } from "lucide-react";
import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenConversationButton } from "@/components/tasks/OpenConversationButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** The agent at work: its current step, with Open conversation and Stop. */
export function TaskProgress({
  step,
  onOpenConversation,
  onStop,
}: {
  step: string;
  onOpenConversation: () => void;
  onStop: () => void;
}) {
  return (
    <AgentLine>
      <TaskStatusIcon status="working" />
      <span className="min-w-0 flex-1 truncate font-mono">{step}</span>
      <OpenConversationButton onClick={onOpenConversation} />
      <Button size="sm" variant="outline" onClick={onStop}>
        <Square className="fill-current" />
        Stop
      </Button>
    </AgentLine>
  );
}
