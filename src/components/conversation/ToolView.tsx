import type { ToolProps } from "@/components/conversation/shared";
import { ToolCallBody } from "@/components/conversation/ToolCallBody";
import { ToolCallHead } from "@/components/conversation/ToolCallHead";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { ToolTile } from "@/components/conversation/ToolTile";
import { useStreamedCall } from "@/hooks/useStreamedCall";
import { toolIcon } from "@/lib/toolIcon";
import { callReason, toolBadge } from "@/lib/toolLabels";

/** One tool call as a row: its tile, title and argument, the agent's why, and its outcome. */
export function ToolView(props: ToolProps) {
  const { call, run } = props;
  const shown = useStreamedCall(call);
  const cancelled = !!run?.cancelled;
  const why = run?.approval ? "" : callReason(call);
  return (
    <ToolRowFrame
      tile={
        <ToolTile
          icon={toolIcon(call)}
          badge={cancelled ? null : toolBadge(run)}
          dim={cancelled}
        />
      }
      head={
        <>
          <ToolCallHead call={shown} run={run} folder={props.folder} />
          {why && <p className="text-[13.5px] text-foreground/85">{why}</p>}
        </>
      }
    >
      <ToolCallBody {...props} shown={shown} />
    </ToolRowFrame>
  );
}
