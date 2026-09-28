import { Loader2 } from "lucide-react";

/** Shown under a tool call that runs with nothing to show yet. */
export function RunningLine() {
  return (
    <p className="flex items-center gap-1.5">
      <Loader2 className="size-3 animate-spin" />
      Running…
    </p>
  );
}
