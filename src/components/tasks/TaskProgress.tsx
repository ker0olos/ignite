import { Square } from "lucide-react";
import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** The agent at work: its current step, with Open chat and Stop. */
export function TaskProgress({
  step,
  onOpenChat,
  onStop,
}: {
  step: string;
  onOpenChat: () => void;
  onStop: () => void;
}) {
  return (
    <AgentLine>
      <TaskStatusIcon status="working" />
      <span className="min-w-0 flex-1 truncate font-mono">{step}</span>
      <OpenChatButton onClick={onOpenChat} />
      <Button size="sm" variant="outline" onClick={onStop}>
        <Square className="fill-current" />
        Stop
      </Button>
    </AgentLine>
  );
}
