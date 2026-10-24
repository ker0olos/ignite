import type { ToolCall } from "../../../shared/agentTypes";
import { scriptReason } from "../../../shared/codemode";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";
import { scriptBadge, type ScriptStatus } from "@/lib/scriptRows";
import { toolIcon } from "@/lib/toolIcon";
import { cn } from "@/lib/utils";

/** A script's first row: its tile, "Script" and its first comment line, and where it stands. */
export function ScriptHeader({
  call,
  status,
  summary,
}: {
  call: ToolCall;
  status: ScriptStatus;
  summary: string;
}) {
  const reason = scriptReason(call.arguments.code);
  return (
    <ToolRowFrame
      tile={<ToolTile icon={toolIcon(call)} badge={scriptBadge(status)} />}
      head={
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[14px] font-semibold text-foreground">
            Script
          </span>
          {reason && (
            <span className="text-[14px] text-foreground/85">{reason}</span>
          )}
        </div>
      }
    >
      <span
        className={cn(
          "text-[13.5px]",
          status === "failed" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {summary}
      </span>
    </ToolRowFrame>
  );
}
