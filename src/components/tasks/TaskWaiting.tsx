import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";

/** A task whose agent waits on the user's approval. */
export function TaskWaiting({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-2.5 py-2 text-xs">
      <TaskStatusIcon status="waiting" />
      <span className="flex-1">Waiting for your approval</span>
      <OpenChatButton onClick={onOpenChat} />
    </div>
  );
}
