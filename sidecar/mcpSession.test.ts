// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentSession, initTheme } from "@earendil-works/pi-coding-agent";
import { expect, it, vi } from "vitest";
import { mcpSessionOpener } from "./mcpSession.ts";

const { AuthStorage } = await import(
  new URL(
    "./core/auth-storage.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
);

it("calls MCP tools in the adapter itself, never as nested pi tool calls", async () => {
  const agentDir = mkdtempSync(join(tmpdir(), "mcp-session-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", agentDir);
  writeFileSync(
    join(agentDir, "mcp.json"),
    JSON.stringify({
      mcpServers: {
        echo: {
          command: process.execPath,
          args: [join(import.meta.dirname, "testMcpServer.ts")],
        },
      },
    }),
  );
  initTheme("dark");
  const open = mcpSessionOpener({
    agentDir,
    mcpExtension: join(import.meta.dirname, "mcpExtension.ts"),
    credentials: AuthStorage.inMemory(),
    uiContext: undefined,
    onAuthUrl: () => {},
  });
  const session = (await open(() => {})) as unknown as AgentSession;
  try {
    const names = () => session.getAllTools().map((t) => t.name);
    await vi.waitFor(() => expect(names()).toContain("mcp__echo"), {
      timeout: 20_000,
    });

    // Offered executeTool, the adapter would register `mcp__echo__echo` and run the call through it.
    const executeTool = vi.fn();
    const result = await session
      .getToolDefinition("mcp")!
      .execute(
        "call-1",
        { tool: "echo_echo", args: { text: "hi" }, reason: "Checks echo" },
        undefined,
        undefined,
        { cwd: agentDir, hasUI: false, tools: [], executeTool } as never,
      );
    expect(result.content).toEqual([{ type: "text", text: "echo: hi" }]);
    expect(executeTool).not.toHaveBeenCalled();
    expect(names().filter((n) => /^mcp__.+__/.test(n))).toEqual([]);
  } finally {
    await session.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    } as never);
    session.dispose();
    vi.unstubAllEnvs();
    rmSync(agentDir, { recursive: true, force: true });
  }
}, 40_000);
