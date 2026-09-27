import type { ToolRun } from "@/lib/transcript";
import { cn } from "@/lib/utils";

/** Status indicator for a tool call or group: running, done, or error. */
export function StatusDot({ run }: { run: ToolRun | undefined }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        !run || run.status === "running"
          ? "animate-pulse bg-muted-foreground"
          : run.status === "error"
            ? "bg-destructive"
            : "bg-success",
      )}
    />
  );
}
