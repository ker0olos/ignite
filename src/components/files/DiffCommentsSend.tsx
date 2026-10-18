import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Send N comments": adds the conversation's comments to its composer. */
export function DiffCommentsSend({
  count,
  onSend,
}: {
  count: number;
  onSend: () => void;
}) {
  return (
    <Button
      size="xs"
      title="Add the comments to the conversation's message"
      onClick={onSend}
    >
      <Send />
      Send {count} {count === 1 ? "comment" : "comments"}
    </Button>
  );
}
