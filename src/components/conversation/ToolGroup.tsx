import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ToolCall } from "../../../shared/agentTypes";
import { StatusDot } from "@/components/conversation/StatusDot";
import { ToolView } from "@/components/conversation/ToolView";
import type { ToolProps } from "@/components/conversation/shared";
import type { ToolRun } from "@/lib/transcript";
import { groupSummary } from "@/lib/toolRows";
import { cn } from "@/lib/utils";

/** Consecutive reads, searches and shell commands, folded into one line. */
export function ToolGroup({
  calls,
  tools,
  ...rest
}: Omit<ToolProps, "call" | "run"> & {
  calls: ToolCall[];
  tools: Record<string, ToolRun>;
}) {
  const [open, setOpen] = useState(false);
  const runs = calls.map((c) => tools[c.id]);
  const running = runs.some((r) => !r || r.status === "running");
  const failed = runs.some((r) => r?.status === "error");
  // A call waiting for approval must be seen, so the group opens for it.
  const waiting = runs.some((r) => r?.approval);
  const status: ToolRun | undefined = running
    ? undefined
    : { status: failed ? "error" : "done" };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <StatusDot run={status} />
        {groupSummary(calls)}
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
      </button>
      {(open || waiting) && (
        <div className="space-y-2 border-l pl-3">
          {calls.map((call) => (
            <ToolView
              key={call.id}
              call={call}
              run={tools[call.id]}
              {...rest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
