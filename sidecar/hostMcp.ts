import type { McpServer, McpServerStatus } from "../shared/hostProtocol.ts";
import {
  shown,
  type HostContext,
  type McpStatusSnapshot,
  type Session,
} from "./hostTypes.ts";

const MCP_STATUSES: Record<string, McpServerStatus> = {
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

/** The MCP session, opened on first use; its status is pushed like a shown conversation's. */
function mcpSession(ctx: HostContext): Promise<Session> {
  if (!ctx.mcpSession) {
    const opening = ctx.openMcpSession(async (snapshot) => {
      ctx.mcpStatus = new Map(snapshot.servers.map((m) => [m.name, m.status]));
      await rememberSignIns(ctx, snapshot);
      await pushMcpServers(ctx);
    });
    ctx.mcpSession = opening;
    opening.catch(() => {
      if (ctx.mcpSession === opening) ctx.mcpSession = null;
    });
  }
  return ctx.mcpSession;
}

/** The MCP session if it has the adapter, which a slash command needs to not reach the model. */
export async function adapterSession(
  ctx: HostContext,
  command = "mcp",
): Promise<Session | undefined> {
  const s = await mcpSession(ctx).catch(() => undefined);
  return s?.extensionRunner.getCommand(command) ? s : undefined;
}

// The shown conversation's status wins once it knows more than "idle".
function adapterStatus(ctx: HostContext, name: string): McpServerStatus {
  const own = MCP_STATUSES[shown(ctx)?.mcpStatus.get(name) ?? ""];
  if (own && own !== "idle") return own;
  return MCP_STATUSES[ctx.mcpStatus.get(name) ?? ""] ?? "idle";
}

/** Lists all servers with their current status. */
export async function mcpServers(ctx: HostContext): Promise<McpServer[]> {
  const saved = await ctx.mcpStore.list();
  const signIns = await ctx.mcpStore.needsSignIn();
  const known = (name: string) => {
    const status = adapterStatus(ctx, name);
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
 * servers in `check` connect once now, in the MCP session, so one that needs
 * sign-in says so while it's being set up rather than when the agent first
 * needs it.
 */
export async function changeMcp(
  ctx: HostContext,
  edit: () => Promise<void>,
  check: string[] = [],
) {
  await edit();
  await reloadSessions(ctx);
  await checkUrlServers(ctx, check);
  return mcpServers(ctx);
}

/** Applies a change to the app's skills, which sessions read on (re)load; returns them. */
export async function changeSkills(
  ctx: HostContext,
  edit: () => Promise<void>,
) {
  await edit();
  await reloadSessions(ctx);
  return ctx.skills.list();
}

/** Reloads the MCP session and every open conversation, a running one once its run ends. */
async function reloadSessions(ctx: HostContext) {
  const mcp = await ctx.mcpSession?.catch(() => undefined);
  await mcp?.reload();
  for (const agent of ctx.agents.values()) {
    const s = agent.session;
    if (s?.isStreaming) agent.reloadWhenSettled = true;
    else await s?.reload();
  }
}

/** Marks the URL servers among `names` as checking, then checks them in the background. */
async function checkUrlServers(ctx: HostContext, names: string[]) {
  const urls = (await ctx.mcpStore.list())
    .filter((m) => names.includes(m.name) && m.enabled)
    .filter((m) => m.config.type === "http")
    .map((m) => m.name);
  urls.forEach((name) => ctx.checking.add(name));
  void (async () => {
    for (const name of urls) {
      // The result arrives as a status snapshot; a failure is shown there.
      const s = await adapterSession(ctx);
      await s?.prompt(`/mcp reconnect ${name}`, {}).catch(() => {});
      ctx.checking.delete(name);
      await pushMcpServers(ctx);
    }
  })();
}
