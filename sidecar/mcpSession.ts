/**
 * Where MCP servers are checked and signed into: one in-memory session that
 * never runs anything and loads only pi-mcp-adapter, so setting up a server
 * works with no conversation open.
 */
import {
  type AgentSession,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { McpStatusSnapshot, Session } from "./hostTypes.ts";
import { MCP_AUTH_URL_EVENT } from "./mcpConfig.ts";
import { freshExtensions, runtimeFor } from "./sessionRuntime.ts";

// pi-mcp-adapter's status channel (MCP_STATUS_EVENT in its types.ts).
export const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";

type Deps = {
  agentDir: string;
  mcpExtension: string;
  credentials: Parameters<typeof runtimeFor>[0];
  uiContext: Parameters<AgentSession["bindExtensions"]>[0]["uiContext"];
  onAuthUrl: (url: string) => void;
};

/** Returns a function opening the MCP session, its status snapshots going to `onMcpStatus`. */
export function mcpSessionOpener(deps: Deps) {
  const { agentDir, credentials, uiContext } = deps;
  return async (
    onMcpStatus: (snapshot: McpStatusSnapshot) => void,
  ): Promise<Session> => {
    const eventBus = createEventBus();
    eventBus.on(MCP_AUTH_URL_EVENT, (url) => deps.onAuthUrl(String(url)));
    eventBus.on(MCP_STATUS_EVENT, (data) =>
      onMcpStatus(data as McpStatusSnapshot),
    );
    const settingsManager = SettingsManager.inMemory();
    const resourceLoader = new DefaultResourceLoader({
      cwd: agentDir,
      agentDir,
      settingsManager,
      eventBus,
      additionalExtensionPaths: [deps.mcpExtension],
    });
    freshExtensions();
    await resourceLoader.reload();
    const { session } = await createAgentSession({
      cwd: agentDir,
      agentDir,
      modelRuntime: await runtimeFor(credentials, agentDir),
      sessionManager: SessionManager.inMemory(agentDir),
      settingsManager,
      resourceLoader,
    });
    // The error listener also makes a reload start the adapter again.
    await session.bindExtensions({
      uiContext,
      onError: ({ event, error }) =>
        process.stderr.write(`pi-host: MCP session (${event}): ${error}\n`),
    });
    const reload = session.reload.bind(session);
    session.reload = () => {
      freshExtensions();
      return reload();
    };
    return session as unknown as Session;
  };
}
