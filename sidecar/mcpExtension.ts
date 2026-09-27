/**
 * pi-mcp-adapter as a pi extension, loaded into every session by main.ts.
 * Given a config, the adapter reads no other source (~/.config/mcp, a
 * project's .mcp.json, other apps' configs): servers come from the app's
 * mcp.json only. It runs on each (re)load, so saved changes apply on reload.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import {
  MCP_AUTH_URL_EVENT,
  MCP_SIGN_IN_COMMAND,
  MCP_SIGN_OUT_COMMAND,
  adapterConfig,
  readMcpFile,
} from "./mcpConfig.ts";
import { APP_TITLE } from "../src/lib/app.ts";

// The adapter's sign-in isn't a public export, and Node can't load its
// TypeScript from node_modules; pi's extension loader can, from here.
// ponytail: file path into the pinned adapter; recheck on upgrades.
const adapterFile = (name: string) =>
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "node_modules",
    "pi-mcp-adapter",
    name,
  );

/**
 * Runs `fn` with the adapter calling us APP_TITLE: the name it registers with
 * a server (shown on the consent page) and its "return to <app>" page both
 * read pi's rebranding manifest (`piConfig.name` in
 * $PI_PACKAGE_DIR/package.json) on every request. pi also loads its themes and
 * docs from that folder, so it points at ours only while signing in.
 */
// ponytail: process-wide env swap; fine while sign-ins are rare and one at a time.
export async function asApp<T>(fn: () => Promise<T>): Promise<T> {
  const dir = join(getAgentDir(), "branding");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ private: true, piConfig: { name: APP_TITLE } }),
  );
  // Renamed, the adapter looks for its agent dir under <NAME>_CODING_AGENT_DIR.
  process.env[`${APP_TITLE.toUpperCase()}_CODING_AGENT_DIR`] = getAgentDir();
  const previous = process.env.PI_PACKAGE_DIR;
  process.env.PI_PACKAGE_DIR = dir;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.PI_PACKAGE_DIR;
    else process.env.PI_PACKAGE_DIR = previous;
  }
}

export default async function mcp(pi: ExtensionAPI) {
  const file = await readMcpFile(join(getAgentDir(), "mcp.json"));
  createMcpAdapter({ config: adapterConfig(file) })(pi);

  // Like the adapter's /mcp-auth, but the app opens the sign-in page: the
  // adapter's own browser launch loses the URL when the app starts it.
  pi.registerCommand(MCP_SIGN_IN_COMMAND, {
    description: "Sign in to an MCP server in the browser",
    handler: async (name, ctx) => {
      try {
        const entry = (await readMcpFile(join(getAgentDir(), "mcp.json")))
          .mcpServers?.[name];
        if (!entry) throw new Error(`There is no server named ${name}.`);
        const { resolveServerUrl } = await import(adapterFile("utils.ts"));
        const { authenticate } = await import(adapterFile("mcp-auth-flow.ts"));
        const url = resolveServerUrl(entry);
        if (!url) throw new Error(`${name} has no URL to sign in to.`);
        const status = await asApp(() =>
          authenticate(name, url, entry, {
            onAuthorizationUrl: () => {},
            openAuthorizationUrl: (authUrl: string) =>
              pi.events.emit(MCP_AUTH_URL_EVENT, authUrl),
            signal: ctx.signal,
          }),
        );
        if (status !== "authenticated") {
          throw new Error(`Signing in to ${name} didn't finish.`);
        }
      } catch (error) {
        ctx.ui.notify(
          `Couldn't sign in to ${name}: ${(error as Error).message}`,
          "error",
        );
      }
    },
  });

  // Sign-ins are stored by server name, so a removed server's must go with it.
  pi.registerCommand(MCP_SIGN_OUT_COMMAND, {
    description: "Delete an MCP server's saved sign-in",
    handler: async (name, ctx) => {
      const { removeAuth } = await import(adapterFile("mcp-auth-flow.ts"));
      await removeAuth(name, { signal: ctx.signal });
    },
  });
}
