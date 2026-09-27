import type { McpCall } from "@/lib/mcpToolCall";

/** Label for an MCP-adapter tool call, formatted per call kind. */
export function McpCallLabel({ call }: { call: McpCall }) {
  const mono = (text: string) => (
    <code className="font-mono text-[12px] font-normal">{text}</code>
  );
  switch (call.kind) {
    case "call":
      return (
        <>
          {call.server && (
            <span className="font-normal text-muted-foreground">
              {call.server} ·{" "}
            </span>
          )}
          {mono(call.tool)}
        </>
      );
    case "search":
      return <>Searched MCP tools for “{call.query}”</>;
    case "describe":
      return <>Looked up {mono(call.tool)}</>;
    case "connect":
      return <>Connected to {call.server}</>;
    case "script":
      return <>Ran an MCP script</>;
    case "other":
      return <>Checked MCP servers</>;
  }
}
