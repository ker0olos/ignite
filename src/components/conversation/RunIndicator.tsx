import { CircleAlert, CircleCheck } from "lucide-react";
import { QuietRequestNote } from "@/components/conversation/QuietRequestNote";
import { StopForkWaitButton } from "@/components/conversation/StopForkWaitButton";
import { WorkingLine } from "@/components/conversation/WorkingLine";
import type { QuietRequest } from "@/lib/quietRequest";
import type { RunState } from "@/lib/transcript";

/** Under a conversation: the agent at work, waiting for the user, or (for a subagent) finished. */
export function RunIndicator({
  state,
  step,
  since,
  thought,
  quiet,
  stopForkWait,
}: {
  state: RunState;
  step?: string;
  since?: number;
  thought?: string;
  quiet?: QuietRequest;
  /** It waits for a fork: stops it waiting. */
  stopForkWait?: () => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col gap-1">
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
          <WorkingLine step={step} since={since} thought={thought} />
        )}
      </div>
      {state === "working" && quiet && <QuietRequestNote {...quiet} />}
      {state === "working" && stopForkWait && (
        <StopForkWaitButton stop={stopForkWait} />
      )}
    </div>
  );
}
