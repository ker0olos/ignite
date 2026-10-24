import type { McpCall } from "@/lib/mcpToolCall";

/** Title for an MCP-adapter call that isn't a tool call (search, describe, connect). */
export function McpCallLabel({
  call,
  failed,
}: {
  call: Exclude<McpCall, { kind: "call" }>;
  failed?: boolean;
}) {
  const mono = (text: string) => (
    <code className="font-mono text-[12px] font-normal">{text}</code>
  );
  switch (call.kind) {
    case "search":
      return <>Searched MCP tools for “{call.query}”</>;
    case "describe":
      return <>Looked up {mono(call.tool)}</>;
    case "connect":
      return failed ? (
        <>Couldn’t connect to {call.server}</>
      ) : (
        <>Connected to {call.server}</>
      );
    case "other":
      return <>Checked MCP servers</>;
  }
}
