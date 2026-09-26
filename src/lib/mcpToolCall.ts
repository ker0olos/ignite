/**
 * pi-mcp-adapter's tools as the conversation shows them. The model reaches
 * MCP servers through `mcp` (search, describe, connect or call a tool), one
 * `mcp__<server>` tool per server, and `mcpScript` (JavaScript that makes
 * several calls).
 */
export type McpCall =
  | { kind: "call"; server?: string; tool: string; args: unknown }
  | { kind: "search"; query: string }
  | { kind: "describe"; tool: string }
  | { kind: "connect"; server: string }
  | { kind: "script"; code: string }
  /** Status, auth and other housekeeping. */
  | { kind: "other" };

const text = (value: unknown) => (typeof value === "string" ? value : "");

// The adapter accepts a tool's arguments as an object or a JSON string.
function toolArgs(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Reads an MCP tool call; null for tools that aren't the adapter's. */
export function mcpCall(
  name: string,
  args: Record<string, unknown>,
): McpCall | null {
  if (name === "mcpScript") return { kind: "script", code: text(args.code) };
  if (name.startsWith("mcp__")) {
    return {
      kind: "call",
      server: name.slice("mcp__".length),
      tool: text(args.tool),
      args: toolArgs(args.args),
    };
  }
  if (name !== "mcp") return null;
  if (args.tool) {
    return {
      kind: "call",
      server: text(args.server) || undefined,
      tool: text(args.tool),
      args: toolArgs(args.args),
    };
  }
  if (args.search) return { kind: "search", query: text(args.search) };
  if (args.describe) return { kind: "describe", tool: text(args.describe) };
  if (args.connect) return { kind: "connect", server: text(args.connect) };
  return { kind: "other" };
}
