import { OpenConversationButton } from "@/components/tasks/OpenConversationButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";

/** A task whose agent waits on the user's approval. */
export function TaskWaiting({
  onOpenConversation,
}: {
  onOpenConversation: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-2.5 py-2 text-xs">
      <TaskStatusIcon status="waiting" />
      <span className="flex-1">Waiting for your approval</span>
      <OpenConversationButton onClick={onOpenConversation} />
    </div>
  );
}
