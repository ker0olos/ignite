import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { PrLink } from "@/components/tasks/PrLink";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** A reopened task with its pull request: Mark done again. */
export function TaskReview({
  pr,
  onOpenChat,
  onDone,
}: {
  pr: string;
  onOpenChat: () => void;
  onDone: () => void;
}) {
  return (
    <AgentLine ok>
      <TaskStatusIcon status="review" />
      <span className="flex-1">Pull request opened.</span>
      <PrLink url={pr} />
      <OpenChatButton onClick={onOpenChat} />
      <Button size="sm" onClick={onDone}>
        Mark done
      </Button>
    </AgentLine>
  );
}
