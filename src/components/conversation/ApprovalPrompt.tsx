import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ApprovalCallout } from "./ApprovalCallout";
import { useApprovalKeys } from "@/hooks/useApprovalKeys";
import { approvalHints } from "@/lib/approvalKeys";

/** Approve or deny a tool call that waits for the user, with why it waits and what it runs. */
export function ApprovalPrompt({
  why,
  reason,
  allow,
  children,
  shortcuts = false,
  queued = 0,
  onAnswer,
}: {
  /** The agent's own reason for the call. */
  why?: string;
  reason?: string;
  /** What the sandbox blocked, which the user may always allow. */
  allow?: string;
  children?: ReactNode;
  /** Takes ⌘↩ and ⌘⌫, and shows them: only the first waiting call does. */
  shortcuts?: boolean;
  /** Other calls waiting behind this one; each opens here once this is answered. */
  queued?: number;
  onAnswer: (approved: boolean, always?: boolean) => void;
}) {
  useApprovalKeys(shortcuts, onAnswer);
  const hints = shortcuts ? approvalHints() : null;
  return (
    <div className="space-y-2 text-[13px]">
      {children}
      <ApprovalCallout reason={reason} why={why} />
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
        {allow && (
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 px-3"
            title={allow}
            onClick={() => onAnswer(true, true)}
          >
            <span className="truncate">Always allow {allow}</span>
          </Button>
        )}
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
        {queued > 0 && (
          <span className="self-center text-xs text-muted-foreground">
            {queued} more waiting
          </span>
        )}
      </div>
    </div>
  );
}
