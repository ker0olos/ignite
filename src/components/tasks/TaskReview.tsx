import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenConversationButton } from "@/components/tasks/OpenConversationButton";
import { PrLink } from "@/components/tasks/PrLink";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** A reopened task with its pull request: Mark done again. */
export function TaskReview({
  pr,
  onOpenConversation,
  onDone,
}: {
  pr: string;
  onOpenConversation: () => void;
  onDone: () => void;
}) {
  return (
    <AgentLine ok>
      <TaskStatusIcon status="review" />
      <span className="flex-1">Pull request opened.</span>
      <PrLink url={pr} />
      <OpenConversationButton onClick={onOpenConversation} />
      <Button size="sm" onClick={onDone}>
        Mark done
      </Button>
    </AgentLine>
  );
}
