import { Button } from "@/components/ui/button";

/** Approve or deny a tool call that waits for the user, with why it waits. */
export function ApprovalPrompt({
  reason,
  onAnswer,
}: {
  reason?: string;
  onAnswer: (approved: boolean) => void;
}) {
  return (
    <div className="space-y-1.5 text-[13px]">
      <p className="text-foreground">{reason ?? "Allow this tool call?"}</p>
      <div className="flex gap-1.5">
        <Button size="xs" onClick={() => onAnswer(true)}>
          Approve
        </Button>
        <Button size="xs" variant="outline" onClick={() => onAnswer(false)}>
          Deny
        </Button>
      </div>
    </div>
  );
}
