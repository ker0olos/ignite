import { useCallback, useEffect, useState } from "react";
import type { McpServer, McpServerConfig } from "../../shared/hostProtocol";
import type { McpCatalog } from "../../shared/mcpCatalog";
import type { HostClient } from "@/lib/piHost";

type McpChange = Extract<
  Parameters<HostClient["request"]>[0],
  {
    type:
      | "mcp_save"
      | "mcp_remove"
      | "mcp_set_enabled"
      | "mcp_sign_in"
      | "mcp_add_preset"
      | "mcp_import";
  }
>;

/**
 * The MCP servers saved for pi, kept current by the sidecar's pushes (status
 * changes, a folder opening). Changes are saved through the sidecar, which
 * applies them to the open session. Also offers servers to add in one click:
 * presets, and other apps' servers for the user and the open `folder`.
 */
export function useMcpServers(
  host: HostClient | null,
  folder: string | null = null,
) {
  const [loaded, setLoaded] = useState<{
    host: HostClient;
    servers: McpServer[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const servers = loaded && loaded.host === host ? loaded.servers : null;
  const [catalog, setCatalog] = useState<McpCatalog | null>(null);
  // What the catalog depends on: which servers are saved (its "added" marks)
  // and the open folder (project servers). Status changes don't count.
  const catalogKey = servers
    ? JSON.stringify([folder, servers.map((m) => m.name)])
    : null;

  useEffect(() => {
    if (!host) return;
    let live = true;
    const show = (servers: McpServer[]) => live && setLoaded({ host, servers });
    const unsubscribe = host.subscribe((message) => {
      if (message.type === "mcp_servers") show(message.servers);
      // A failed sign-in is reported by the adapter, not the request.
      else if (message.type === "extension_error") setError(message.message);
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

  useEffect(() => {
    if (!host || !catalogKey) return;
    let live = true;
    host
      .request({ type: "mcp_catalog", ...(folder && { cwd: folder }) })
      .then((catalog) => live && setCatalog(catalog))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, catalogKey, folder]);

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
    /** Signs in in the browser; resolves once it's done or has failed. */
    signIn: (name: string) => act({ type: "mcp_sign_in", name }),
    /** Null until loaded; the last one stays while a refresh loads. */
    catalog,
    addPreset: (preset: string) => act({ type: "mcp_add_preset", preset }),
    importServers: (source: string, names: string[]) =>
      act({
        type: "mcp_import",
        source,
        names,
        ...(folder && { cwd: folder }),
      }),
  };
}
