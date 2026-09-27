// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { writeMcpFile } from "./mcpConfig.ts";
import mcp from "./mcpExtension.ts";

const install = vi.fn();
vi.mock("pi-mcp-adapter", () => ({ createMcpAdapter: vi.fn(() => install) }));

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "mcp-ext-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", dir);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const pi = {} as ExtensionAPI;

it("installs the adapter with the app's servers only", async () => {
  await writeMcpFile(join(dir, "mcp.json"), {
    mcpServers: { docs: { command: "npx" } },
    imports: ["cursor"],
  });
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenCalledWith({
    config: { mcpServers: { docs: { command: "npx" } } },
  });
  expect(install).toHaveBeenCalledWith(pi);
});

it("installs it with no servers before any are added", async () => {
  await mcp(pi);
  expect(createMcpAdapter).toHaveBeenCalledWith({
    config: { mcpServers: {} },
  });
});
