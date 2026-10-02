import { useState } from "react";
import { Play } from "lucide-react";
import { OpenConversationButton } from "@/components/tasks/OpenConversationButton";
import { TaskStatusIcon } from "@/components/tasks/TaskStatusIcon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** A task whose pull request was declined, or that finished without one: what to change, then Resume, or Mark done. */
export function TaskResume({
  declined,
  onResume,
  onOpenConversation,
  onDone,
}: {
  declined?: boolean;
  onResume: (text: string) => void;
  onOpenConversation: () => void;
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
            : "Finished without a pull request. The conversation says why."}
        </span>
        <OpenConversationButton onClick={onOpenConversation} />
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
