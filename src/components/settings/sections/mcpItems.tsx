import type { McpServer } from "../../../../shared/hostProtocol";
import { serverRowId, type Item } from "@/components/settings/sections";
import { McpServerControls } from "@/components/mcp/McpServerControls";
import { Button } from "@/components/ui/button";
import type { useMcpServers } from "@/hooks/useMcpServers";

/** Settings rows for MCP servers, plus the "Add a custom server" entry. */
export function mcpItems({
  mcp,
  onEdit,
  onAdd,
}: {
  mcp: ReturnType<typeof useMcpServers>;
  onEdit: (server: McpServer) => void;
  onAdd: () => void;
}): Item[] {
  return [
    ...(mcp.error
      ? [
          {
            section: "MCP" as const,
            title: "Something went wrong",
            description: mcp.error,
          },
        ]
      : []),
    ...(mcp.servers ?? []).map((server) => ({
      section: "MCP" as const,
      id: serverRowId(server.name),
      title: server.name,
      keywords: `mcp server tool ${server.tools.join(" ")}`,
      control: (
        <McpServerControls
          server={server}
          onEdit={() => onEdit(server)}
          onEnabledChange={(enabled) => mcp.setEnabled(server.name, enabled)}
          onSignIn={() => mcp.signIn(server.name)}
          onRemove={() => mcp.remove(server.name)}
        />
      ),
    })),
    {
      section: "MCP",
      title: "Add a custom server",
      description:
        "Connect any MCP server by its URL, or run one as a local command.",
      keywords: "mcp server tool add new import preset claude cursor codex",
      control: (
        <Button variant="outline" size="sm" onClick={onAdd}>
          Add
        </Button>
      ),
    },
  ];
}
