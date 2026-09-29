import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useApprovalKeys } from "@/hooks/useApprovalKeys";
import { approvalHints } from "@/lib/approvalKeys";

/** Approve or deny a tool call that waits for the user, with why it waits and what it runs. */
export function ApprovalPrompt({
  reason,
  children,
  shortcuts = false,
  onAnswer,
}: {
  reason?: string;
  children?: ReactNode;
  /** Takes ⌘↩ and ⌘⌫, and shows them: only the first waiting call does. */
  shortcuts?: boolean;
  onAnswer: (approved: boolean) => void;
}) {
  useApprovalKeys(shortcuts, onAnswer);
  const hints = shortcuts ? approvalHints() : null;
  return (
    <div className="space-y-2 text-[13px]">
      {children}
      <p className="text-foreground">{reason ?? "Allow this tool call?"}</p>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="px-3"
          aria-keyshortcuts={hints ? "Meta+Enter" : undefined}
          onClick={() => onAnswer(true)}
        >
          Approve
          {hints && (
            <span aria-hidden className="opacity-60">
              {hints.approve}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3"
          aria-keyshortcuts={hints ? "Meta+Backspace" : undefined}
          onClick={() => onAnswer(false)}
        >
          Deny
          {hints && (
            <span aria-hidden className="opacity-60">
              {hints.deny}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
