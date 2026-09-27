/**
 * pi-mcp-adapter as a pi extension, loaded into every session by main.ts.
 * Given a config, the adapter reads no other source (~/.config/mcp, a
 * project's .mcp.json, other apps' configs): servers come from the app's
 * mcp.json only. It runs on each (re)load, so saved changes apply on reload.
 */
import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import { adapterConfig, readMcpFile } from "./mcpConfig.ts";

export default async function mcp(pi: ExtensionAPI) {
  const file = await readMcpFile(join(getAgentDir(), "mcp.json"));
  createMcpAdapter({ config: adapterConfig(file) })(pi);
}
