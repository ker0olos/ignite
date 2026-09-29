import {
  MCP_SIGN_IN_COMMAND,
  MCP_SIGN_OUT_COMMAND,
  MCP_COPY_SIGN_IN_COMMAND,
} from "./mcpConfig.ts";
import type { HostContext } from "./hostTypes.ts";
import { adapterSession, mcpServers } from "./hostMcp.ts";

// ponytail: a failed sign-out leaves the sign-in saved, so re-adding the name
// signs back in; retry it if that shows up.
/** Deletes a server's saved sign-in, so removing and re-adding it asks again. */
export async function signOut(ctx: HostContext, name: string) {
  const s = await adapterSession(ctx, MCP_SIGN_OUT_COMMAND);
  await s?.prompt(`/${MCP_SIGN_OUT_COMMAND} ${name}`, {}).catch(() => {});
}

/** Signs into an MCP server, then connects it in open conversations too. */
export async function signIn(ctx: HostContext, name: string) {
  const server = (await ctx.mcpStore.list()).find((m) => m.name === name);
  if (!server) throw new Error(`There is no server named ${name}.`);
  if (!server.enabled) throw new Error(`Turn ${name} on first.`);
  // Without the adapter, pi would send the command to the model as text.
  const s = await adapterSession(ctx);
  if (!s) throw new Error("MCP isn't running. Check mcp.json.");
  if (!s.extensionRunner.getCommand(MCP_SIGN_IN_COMMAND)) {
    throw new Error("MCP sign-in isn't available.");
  }
  // Opens the sign-in page through the app and waits for the browser's
  // callback; a failure comes back as an extension_error.
  await s.prompt(`/${MCP_SIGN_IN_COMMAND} ${name}`, {});
  await s.prompt(`/mcp reconnect ${name}`, {});
  for (const agent of ctx.agents.values()) {
    const own = agent.session;
    if (own && !own.isStreaming && own.extensionRunner.getCommand("mcp")) {
      await own.prompt(`/mcp reconnect ${name}`, {}).catch(() => {});
    }
  }
  return mcpServers(ctx);
}

// A refused keychain or no saved sign-in leaves the server to sign in as usual.
/** Copies a server's saved sign-in from Claude Code's keychain. */
export async function copySignIn(ctx: HostContext, name: string) {
  const s = await adapterSession(ctx, MCP_COPY_SIGN_IN_COMMAND);
  await s?.prompt(`/${MCP_COPY_SIGN_IN_COMMAND} ${name}`, {}).catch(() => {});
}
