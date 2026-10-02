import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenConversationButton } from "@/components/tasks/OpenConversationButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** The pull request a task's agent waits to open: Approve opens it and completes the task, Decline stops the agent. */
export function TaskPrReview({
  review,
  onAnswer,
  onOpenConversation,
}: {
  review: GitReview;
  onAnswer: (approved: boolean) => void;
  onOpenConversation: () => void;
}) {
  return (
    <div className="space-y-2">
      <GitChanges review={review} />
      <AgentLine ok>
        <TaskStatusIcon status="review" />
        <span className="flex-1">Open this pull request?</span>
        <OpenConversationButton onClick={onOpenConversation} />
        <Button size="sm" variant="outline" onClick={() => onAnswer(false)}>
          Decline
        </Button>
        <Button size="sm" onClick={() => onAnswer(true)}>
          Approve
        </Button>
      </AgentLine>
    </div>
  );
}
