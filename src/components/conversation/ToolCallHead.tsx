import type { ToolCall } from "../../../shared/agentTypes";
import { McpCallHead } from "@/components/conversation/McpCallHead";
import { McpCallLabel } from "@/components/conversation/McpCallLabel";
import { ToolHead } from "@/components/conversation/ToolHead";
import { mcpCall } from "@/lib/mcpToolCall";
import { toolArg, toolTitle } from "@/lib/toolLabels";
import type { ToolRun } from "@/lib/transcript";

/** A tool call's title line; under a shared tile (`grouped`) without what the tile's title already says. */
export function ToolCallHead({
  call,
  run,
  folder,
  grouped = false,
}: {
  call: ToolCall;
  run: ToolRun | undefined;
  folder: string;
  grouped?: boolean;
}) {
  const mcp = mcpCall(call.name, call.arguments);
  const muted = run?.cancelled;
  if (mcp?.kind === "call") {
    return (
      <McpCallHead mcp={mcp} folder={folder} grouped={grouped} muted={muted} />
    );
  }
  if (mcp) {
    const label = <McpCallLabel call={mcp} failed={run?.status === "error"} />;
    return <ToolHead title={label} arg="" folder={folder} muted={muted} />;
  }
  return (
    <ToolHead
      title={grouped ? undefined : toolTitle(call)}
      arg={toolArg(call, folder)}
      folder={folder}
      muted={muted}
    />
  );
}
