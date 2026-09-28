import type { McpServer, McpServerStatus } from "../shared/hostProtocol.ts";
import {
  shown,
  type HostContext,
  type McpStatusSnapshot,
} from "./hostTypes.ts";

export const MCP_STATUSES: Record<string, McpServerStatus> = {
  connected: "connected",
  cached: "idle",
  "not-connected": "idle",
  failed: "failed",
  "needs-auth": "needs-auth",
  disabled: "disabled",
};

// What the adapter learns about sign-in outlives it: a server stays "needs
// sign-in" after a restart until it connects, without connecting to find out.
/** Saves which servers need sign-in from the adapter's status snapshot. */
export async function rememberSignIns(
  ctx: HostContext,
  snapshot: McpStatusSnapshot,
) {
  for (const { name, status } of snapshot.servers) {
    if (status === "needs-auth") await ctx.mcpStore.setNeedsSignIn(name, true);
    if (status === "connected") await ctx.mcpStore.setNeedsSignIn(name, false);
  }
}

/** Lists all servers with their current status. */
export async function mcpServers(ctx: HostContext): Promise<McpServer[]> {
  const saved = await ctx.mcpStore.list();
  const project = shown(ctx);
  if (!project?.session) return saved;
  const signIns = await ctx.mcpStore.needsSignIn();
  const known = (name: string) => {
    const status = MCP_STATUSES[project.mcpStatus.get(name) ?? ""] ?? "idle";
    return status === "idle" && signIns.includes(name) ? "needs-auth" : status;
  };
  // ponytail: a failed server shows no reason; the adapter only logs it to
  // stderr. Show it once the status snapshot carries one.
  return saved.map((server) => ({
    ...server,
    status: !server.enabled
      ? "disabled"
      : ctx.checking.has(server.name)
        ? "checking"
        : known(server.name),
  }));
}

/** Sends the current server list to the app. */
export async function pushMcpServers(ctx: HostContext) {
  try {
    ctx.send({ type: "mcp_servers", servers: await mcpServers(ctx) });
  } catch {
    // mcp.json is unreadable; the next request reports why.
  }
}

// The session's adapter only reads mcp.json on (re)load.
/**
 * Saves a change and applies it. Servers still connect lazily, but URL
 * servers in `check` connect once now, so one that needs sign-in says so
 * while it's being set up rather than when the agent first needs it.
 */
export async function changeMcp(
  ctx: HostContext,
  edit: () => Promise<void>,
  check: string[] = [],
) {
  await edit();
  for (const project of ctx.projects.values()) {
    const s = project.session;
    if (s?.isStreaming) project.reloadWhenSettled = true;
    else await s?.reload();
  }
  const s = shown(ctx)?.session;
  if (s && !s.isStreaming) await checkUrlServers(ctx, check);
  return mcpServers(ctx);
}

/** Marks the URL servers among `names` as checking, then checks them in the background. */
export async function checkUrlServers(ctx: HostContext, names: string[]) {
  const s = shown(ctx)?.session;
  if (!s?.extensionRunner.getCommand("mcp")) return;
  const urls = (await ctx.mcpStore.list())
    .filter((m) => names.includes(m.name) && m.enabled)
    .filter((m) => m.config.type === "http")
    .map((m) => m.name);
  urls.forEach((name) => ctx.checking.add(name));
  void (async () => {
    for (const name of urls) {
      // The result arrives as a status snapshot; a failure is shown there.
      await s.prompt(`/mcp reconnect ${name}`, {}).catch(() => {});
      ctx.checking.delete(name);
      await pushMcpServers(ctx);
    }
  })();
}
