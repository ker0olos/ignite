/**
 * A tiny stdio MCP server for tests: one `echo` tool. Speaks just enough
 * JSON-RPC for pi-mcp-adapter to connect, list tools and call one. With
 * `--touch <file>` it only creates that file and exits, to prove it started.
 */
import { writeFileSync } from "node:fs";
import { createLineSplitter } from "./lines.ts";

const touch = process.argv.indexOf("--touch");
if (touch !== -1) {
  writeFileSync(process.argv[touch + 1], "");
  process.exit(0);
}

const send = (message: object) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");

const RESULTS: Record<string, (params: Record<string, unknown>) => object> = {
  initialize: (params) => ({
    protocolVersion: params.protocolVersion,
    capabilities: { tools: {} },
    serverInfo: { name: "echo", version: "1.0.0" },
  }),
  "tools/list": () => ({
    tools: [
      {
        name: "echo",
        description: "Echoes text back",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ],
  }),
  "tools/call": (params) => ({
    content: [
      {
        type: "text",
        text: `echo: ${(params.arguments as { text: string }).text}`,
      },
    ],
  }),
  ping: () => ({}),
};

const lines = createLineSplitter((line) => {
  const { id, method, params } = JSON.parse(line);
  // Notifications have no id and get no answer.
  if (id === undefined) return;
  const result = RESULTS[method];
  send(
    result
      ? { id, result: result(params ?? {}) }
      : { id, error: { code: -32601, message: `No method ${method}` } },
  );
});
process.stdin.on("data", lines.push);
