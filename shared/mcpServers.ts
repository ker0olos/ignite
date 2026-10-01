/** MCP servers as they cross the wire (re-exported by hostProtocol.ts). */

/** How to reach an MCP server: a local command (stdio) or a URL (HTTP). */
export type McpServerConfig =
  | {
      type: "stdio";
      command: string;
      args: string[];
      env: Record<string, string>;
    }
  | { type: "http"; url: string; headers: Record<string, string> };

/**
 * A server in the open folder's session. pi-mcp-adapter connects servers on
 * first use, so "idle" is the normal state of a working server.
 */
export type McpServerStatus =
  | "connected"
  | "idle"
  /** Being connected once after it was set up, to learn its real status. */
  | "checking"
  | "failed"
  | "needs-auth"
  | "disabled";

/** A server saved in pi's mcp.json, with what the session knows about it. */
export type McpServer = {
  name: string;
  enabled: boolean;
  config: McpServerConfig;
  /** Unset while no folder is open: servers only run inside a session. */
  status?: McpServerStatus;
  /** Tool names from its last connection; empty until it has connected once. */
  tools: string[];
};
