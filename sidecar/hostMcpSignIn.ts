import {
  MCP_SIGN_IN_COMMAND,
  MCP_SIGN_OUT_COMMAND,
  MCP_COPY_SIGN_IN_COMMAND,
} from "./mcpConfig.ts";
import { current, shown, type HostContext } from "./hostTypes.ts";
import { mcpServers } from "./hostMcp.ts";

/**
 * Deletes a server's saved sign-in, so removing and re-adding it asks again.
 * Without a session to run it in, it runs when the next folder opens.
 */
export async function signOut(ctx: HostContext, name: string) {
  const s = shown(ctx)?.session;
  if (s?.extensionRunner.getCommand(MCP_SIGN_OUT_COMMAND)) {
    try {
      await s.prompt(`/${MCP_SIGN_OUT_COMMAND} ${name}`, {});
      return;
    } catch {
      // Retried when the next folder opens.
    }
  }
  ctx.pendingSignOuts.add(name);
}

/** Signs into an MCP server. */
export async function signIn(ctx: HostContext, name: string) {
  const s = await usableServer(ctx, name);
  if (!s.extensionRunner.getCommand(MCP_SIGN_IN_COMMAND)) {
    throw new Error("MCP sign-in isn't available in this session.");
  }
  // Opens the sign-in page through the app and waits for the browser's
  // callback; a failure comes back as an extension_error.
  await s.prompt(`/${MCP_SIGN_IN_COMMAND} ${name}`, {});
  await s.prompt(`/mcp reconnect ${name}`, {});
  return mcpServers(ctx);
}

async function usableServer(ctx: HostContext, name: string) {
  const s = await current(ctx);
  const server = (await ctx.mcpStore.list()).find((m) => m.name === name);
  if (!server) throw new Error(`There is no server named ${name}.`);
  if (!server.enabled) throw new Error(`Turn ${name} on first.`);
  // Without the adapter, pi would send the command to the model as text.
  if (!s.extensionRunner.getCommand("mcp")) {
    throw new Error("MCP isn't running in this session. Check mcp.json.");
  }
  return s;
}

// A refused keychain or no saved sign-in leaves the server to sign in as usual.
/** Copies a server's saved sign-in from Claude Code's keychain. */
export async function copySignIn(ctx: HostContext, name: string) {
  const s = shown(ctx)?.session;
  if (!s?.extensionRunner.getCommand(MCP_COPY_SIGN_IN_COMMAND)) return;
  await s.prompt(`/${MCP_COPY_SIGN_IN_COMMAND} ${name}`, {}).catch(() => {});
}
