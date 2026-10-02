import { UserBubble } from "@/components/conversation/UserBubble";
import type { Row } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** User message row with optional sticky positioning. */
export function UserMessageRow({
  message,
  sticky,
}: {
  message: Extract<Row, { kind: "user" }>["message"];
  sticky: boolean;
}) {
  return (
    <div
      className={cn(
        sticky && "sticky top-0 z-10 -mx-4 bg-background px-4 py-2",
      )}
    >
      <UserBubble message={message} />
    </div>
  );
}
