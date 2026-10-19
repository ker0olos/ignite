import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { loadTerminalView } from "@/components/children/loadTerminalView";

/** A terminal's tab while the sidecar starts its shell, waiting for the conversation's worktree; where its first line will be. */
export function TerminalStarting() {
  useEffect(() => void loadTerminalView(), []);
  return (
    <div className="flex items-center gap-2 px-5 py-4 text-[13px] text-muted-foreground">
      <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
      Starting a terminal in this conversation's worktree…
    </div>
  );
}
