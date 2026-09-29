import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A small icon button that shows the task's conversation. */
export function OpenChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Open chat"
      title="Open chat"
      className="text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <MessageSquare />
    </Button>
  );
}
