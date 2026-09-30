import { useState } from "react";
import { Play } from "lucide-react";
import { OpenChatButton } from "@/components/tasks/OpenChatButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** A task whose pull request was declined, or that finished without one: what to change, then Resume, or Mark done. */
export function TaskResume({
  declined,
  onResume,
  onOpenChat,
  onDone,
}: {
  declined?: boolean;
  onResume: (text: string) => void;
  onOpenChat: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    onResume(text.trim());
    setText("");
  };
  return (
    <div className="space-y-2 rounded-lg bg-muted px-2.5 py-2 text-xs">
      <div className="flex items-center gap-2">
        <TaskStatusIcon status={declined ? "declined" : "review"} />
        <span className="flex-1">
          {declined
            ? "Pull request declined. Say what to change, then resume."
            : "Finished without a pull request. The chat says why."}
        </span>
        <OpenChatButton onClick={onOpenChat} />
        <Button size="sm" variant="ghost" onClick={onDone}>
          Mark done
        </Button>
      </div>
      <Textarea
        value={text}
        placeholder="What should change?"
        className="min-h-12 bg-background text-[13px] md:text-[13px]"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={!text.trim()} onClick={send}>
          <Play className="fill-current" />
          Resume
        </Button>
      </div>
    </div>
  );
}
