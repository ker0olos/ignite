import { ToolHead } from "@/components/conversation/ToolHead";
import type { McpCall } from "@/lib/mcpToolCall";
import { serverName } from "@/lib/toolIcon";
import { mcpArg, mcpTitle } from "@/lib/toolLabels";

/** An MCP tool call's title line: its humanized name, its server unless the shared tile names it, and its arguments. */
export function McpCallHead({
  mcp,
  folder,
  grouped,
  muted,
}: {
  mcp: Extract<McpCall, { kind: "call" }>;
  folder: string;
  grouped: boolean;
  muted?: boolean;
}) {
  return (
    <ToolHead
      title={mcp.tool ? mcpTitle(mcp.tool) : "MCP call"}
      server={grouped || !mcp.server ? undefined : serverName(mcp.server)}
      arg={mcpArg(mcp)}
      folder={folder}
      muted={muted}
    />
  );
}
