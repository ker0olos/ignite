// pi-mcp-adapter ships TypeScript source that doesn't pass this project's
// strict settings, so tsconfig.sidecar.json maps the import here. Mirrors
// createMcpAdapter in node_modules/pi-mcp-adapter/index.ts; recheck on upgrades.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function createMcpAdapter(options?: {
  config?: {
    mcpServers: Record<string, Record<string, unknown>>;
    settings?: Record<string, unknown>;
  };
  configPath?: string;
}): (pi: ExtensionAPI) => void;
