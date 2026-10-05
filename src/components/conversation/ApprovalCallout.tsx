import { Lock } from "lucide-react";

/** Why a tool call waits: what the app stopped and the agent's own reason, if either is known. */
export function ApprovalCallout({
  reason,
  why,
}: {
  reason?: string;
  why?: string;
}) {
  if (!reason && !why) return null;
  return (
    <div className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2">
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <div className="min-w-0 space-y-0.5">
        {reason && <p className="font-medium text-warning">{reason}</p>}
        {why && <p className="text-foreground">{why}</p>}
      </div>
    </div>
  );
}
