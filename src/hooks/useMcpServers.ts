import { useCallback, useEffect, useState } from "react";
import type { McpServer, McpServerConfig } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

type McpChange = Extract<
  Parameters<HostClient["request"]>[0],
  { type: "mcp_save" | "mcp_remove" | "mcp_set_enabled" | "mcp_reconnect" }
>;

/**
 * The MCP servers saved for pi, kept current by the sidecar's pushes (status
 * changes, a folder opening). Changes are saved through the sidecar, which
 * applies them to the open session.
 */
export function useMcpServers(host: HostClient | null) {
  const [loaded, setLoaded] = useState<{
    host: HostClient;
    servers: McpServer[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const servers = loaded && loaded.host === host ? loaded.servers : null;

  useEffect(() => {
    if (!host) return;
    let live = true;
    const show = (servers: McpServer[]) => live && setLoaded({ host, servers });
    const unsubscribe = host.subscribe((message) => {
      if (message.type === "mcp_servers") show(message.servers);
    });
    host
      .request({ type: "mcp_list" })
      .then(show)
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
      unsubscribe();
    };
  }, [host]);

  /** Sends a change; resolves with what went wrong, or null. */
  const change = useCallback(
    async (request: McpChange): Promise<string | null> => {
      if (!host) return "The agent host isn't running.";
      try {
        const servers = await host.request(request);
        setLoaded({ host, servers });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [host],
  );

  // Row actions report failures in `error`; the form shows its own.
  const act = useCallback(
    async (request: McpChange) => {
      setError(null);
      setError(await change(request));
    },
    [change],
  );

  return {
    /** Null until the sidecar has answered. */
    servers,
    error,
    /** Adds a server, or replaces `previousName`; resolves with a problem or null. */
    save: (name: string, config: McpServerConfig, previousName?: string) =>
      change({ type: "mcp_save", name, config, previousName }),
    remove: (name: string) => act({ type: "mcp_remove", name }),
    setEnabled: (name: string, enabled: boolean) =>
      act({ type: "mcp_set_enabled", name, enabled }),
    reconnect: (name: string) => act({ type: "mcp_reconnect", name }),
  };
}
