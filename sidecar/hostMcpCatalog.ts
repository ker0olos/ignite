import { needsSignIn } from "./mcpCatalog.ts";
import type { McpCatalog } from "../shared/hostProtocol.ts";
import type { HostContext } from "./hostTypes.ts";
import { changeMcp } from "./hostMcp.ts";
import { copySignIn } from "./hostMcpSignIn.ts";

/** Server names end up in tool names (mcp__<server>), so keep them simple. */
export const toServerName = (name: string) =>
  name.replace(/[^A-Za-z0-9_-]+/g, "-");

/** Returns the command or URL target for an MCP entry. */
export const target = (e: Record<string, unknown>) =>
  typeof e.url === "string"
    ? e.url
    : [e.command as string, ...((e.args as string[]) ?? [])].join(" ");

/** Returns the MCP catalog with presets and importable servers. */
export async function mcpCatalog(
  ctx: HostContext,
  cwd?: string,
): Promise<McpCatalog> {
  const taken = new Set((await ctx.mcpStore.list()).map((m) => m.name));
  const sources = await ctx.catalog.findImports(cwd);
  return {
    presets: ctx.catalog.presets.map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      signIn: needsSignIn(p.entry),
      added: taken.has(p.id),
    })),
    sources: sources.map(({ id, app, scope, servers }) => ({
      id,
      app,
      scope,
      servers: Object.entries(servers).map(([name, entry]) => ({
        name,
        target: target(entry),
        added: taken.has(toServerName(name)),
      })),
    })),
  };
}

/** Adds a preset to the MCP configuration. */
export async function addPreset(ctx: HostContext, id: string) {
  const preset = ctx.catalog.presets.find((p) => p.id === id);
  if (!preset) throw new Error(`There is no preset named ${id}.`);
  return changeMcp(ctx, () => ctx.mcpStore.add({ [preset.id]: preset.entry }), [
    preset.id,
  ]);
}

/** Imports servers from an external source into the MCP configuration. */
export async function importServers(
  ctx: HostContext,
  sourceId: string,
  names: string[],
  cwd?: string,
) {
  const source = (await ctx.catalog.findImports(cwd)).find(
    (s) => s.id === sourceId,
  );
  if (!source) throw new Error("Those servers are no longer there.");
  const entries = Object.entries(source.servers)
    .filter(([name]) => names.includes(name))
    .map(([name, entry]) => [toServerName(name), entry] as const);
  return changeMcp(
    ctx,
    async () => {
      await ctx.mcpStore.add(Object.fromEntries(entries));
      if (source.app === "Claude Code") {
        for (const [name, entry] of entries) {
          if ("url" in entry) {
            await copySignIn(ctx, name);
          }
        }
      }
    },
    entries.map(([name]) => name),
  );
}
