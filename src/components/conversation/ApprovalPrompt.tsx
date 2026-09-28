import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Approve or deny a tool call that waits for the user, with why it waits and what it runs. */
export function ApprovalPrompt({
  reason,
  children,
  onAnswer,
}: {
  reason?: string;
  children?: ReactNode;
  onAnswer: (approved: boolean) => void;
}) {
  return (
    <div className="space-y-1.5 text-[13px]">
      {children}
      <p className="text-foreground">{reason ?? "Allow this tool call?"}</p>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="px-3" onClick={() => onAnswer(true)}>
          <Check />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3"
          onClick={() => onAnswer(false)}
        >
          <X />
          Deny
        </Button>
      </div>
    </div>
  );
}
