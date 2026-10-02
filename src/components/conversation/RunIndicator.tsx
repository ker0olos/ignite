import { CircleAlert, CircleCheck } from "lucide-react";
import { WorkingLine } from "@/components/conversation/WorkingLine";
import type { RunState } from "@/lib/transcript";

/** Under a conversation: the agent at work, waiting for the user, or (for a subagent) finished. */
export function RunIndicator({
  state,
  step,
  since,
}: {
  state: RunState;
  step?: string;
  since?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {state === "waiting" ? (
        <>
          <CircleAlert className="size-3.5 text-warning" />
          Waiting for you
        </>
      ) : state === "finished" ? (
        <>
          <CircleCheck className="size-3.5 text-success" />
          Finished
        </>
      ) : (
        <WorkingLine step={step} since={since} />
      )}
    </div>
  );
}
