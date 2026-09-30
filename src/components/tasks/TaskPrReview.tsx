import type { GitReview } from "../../../shared/git";
import { GitChanges } from "@/components/conversation/GitChanges";
import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** The pull request a task's agent waits to open: Approve opens it and completes the task, Decline stops the agent. */
export function TaskPrReview({
  review,
  onAnswer,
  onOpenChat,
}: {
  review: GitReview;
  onAnswer: (approved: boolean) => void;
  onOpenChat: () => void;
}) {
  return (
    <div className="space-y-2">
      <GitChanges review={review} />
      <AgentLine ok>
        <TaskStatusIcon status="review" />
        <span className="flex-1">Open this pull request?</span>
        <OpenChatButton onClick={onOpenChat} />
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
