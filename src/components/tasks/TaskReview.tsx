import { AgentLine } from "@/components/tasks/AgentLine";
import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { PrLink } from "@/components/tasks/PrLink";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";

/** A finished task: its pull request to review, or word that it has none; then Mark done. */
export function TaskReview({
  pr,
  onOpenChat,
  onDone,
}: {
  pr?: string;
  onOpenChat: () => void;
  onDone: () => void;
}) {
  return (
    <AgentLine ok>
      <TaskStatusIcon status="review" />
      <span className="flex-1">
        {pr
          ? "Ready for review. Merge the pull request, then mark it done."
          : "Finished without a pull request. The chat says why."}
      </span>
      {pr && <PrLink url={pr} />}
      <OpenChatButton onClick={onOpenChat} />
      <Button size="sm" onClick={onDone}>
        Mark done
      </Button>
    </AgentLine>
  );
}
