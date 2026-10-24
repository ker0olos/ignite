import type { ToolCall } from "../../../shared/agentTypes";
import type { ToolProps } from "@/components/conversation/shared";
import { ToolCallStep } from "@/components/conversation/ToolCallStep";
import { ToolTile } from "@/components/conversation/ToolTile";
import { mcpCall } from "@/lib/mcpToolCall";
import { serverName, toolIcon } from "@/lib/toolIcon";
import { groupBadge, groupCount, toolTitle } from "@/lib/toolLabels";

// The tile's title: the tool's, or for MCP calls their server's.
function groupTitle(call: ToolCall) {
  const mcp = mcpCall(call.name, call.arguments);
  return mcp?.kind === "call" && mcp.server
    ? serverName(mcp.server)
    : toolTitle(call);
}

/** Consecutive calls of one tool under one tile and title, as dots on a line from it, each with its own argument, why and outcome. */
export function ToolCallGroup({
  calls,
  tools = {},
  ...rest
}: Omit<ToolProps, "call" | "run"> & { calls: ToolCall[] }) {
  const runs = calls.map((c) => tools[c.id]);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative flex items-center gap-3.5">
        <span
          aria-hidden
          className="absolute top-[30px] -bottom-5 left-[14.5px] w-px bg-foreground/12"
        />
        <ToolTile icon={toolIcon(calls[0])} badge={groupBadge(runs)} />
        <span className="text-[14px] font-semibold text-foreground">
          {groupTitle(calls[0])}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {groupCount(calls)}
        </span>
      </div>
      <div className="flex flex-col gap-[18px]">
        {calls.map((call, i) => (
          <ToolCallStep
            key={call.id}
            {...rest}
            last={i === calls.length - 1}
            call={call}
            run={tools[call.id]}
            tools={tools}
          />
        ))}
      </div>
    </div>
  );
}
