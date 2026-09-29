import { CircleAlert, Loader2 } from "lucide-react";

/** Under a running conversation: the agent at work, or waiting for the user to answer a call. */
export function RunIndicator({ waiting }: { waiting: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {waiting ? (
        <>
          <CircleAlert className="size-3.5 text-warning" />
          Waiting for you
        </>
      ) : (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Working
        </>
      )}
    </div>
  );
}
