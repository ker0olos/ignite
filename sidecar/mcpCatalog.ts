/**
 * Servers the MCP settings offer to import: those already set up in other
 * apps on this Mac (Claude Code, Cursor, Codex, Claude Desktop), user-wide or
 * for one folder (any of Claude Code's, else the open one). Importing copies
 * an entry into the app's mcp.json; the other apps' files are only read.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { McpEntry } from "./mcpConfig.ts";

/** Whether a server signs in with OAuth (the app can't do that yet). */
export const needsSignIn = (entry: McpEntry) => entry.auth === "oauth";

/** An app's servers found on this Mac. */
export type ImportSource = {
  id: string;
  app: string;
  /** "project": set up for one folder only; the open one unless `folder`. */
  scope: "user" | "project";
  folder?: string;
  servers: Record<string, McpEntry>;
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  !!v && typeof v === "object" && !Array.isArray(v);

const strings = (v: unknown): Record<string, string> | undefined => {
  if (!isObject(v)) return undefined;
  const entries = Object.entries(v).filter(([, s]) => typeof s === "string");
  return entries.length
    ? (Object.fromEntries(entries) as Record<string, string>)
    : undefined;
};

/**
 * The transport part of another app's entry, in the adapter's format; other
 * apps' extra fields (Claude Code's `type`, Codex's timeouts) are dropped. The
 * adapter's `url` covers Streamable HTTP and SSE. Returns undefined if unusable.
 */
function urlEntry(raw: Json): McpEntry {
  const headers = strings(raw.headers) ?? strings(raw.http_headers);
  return { url: raw.url as string, ...(headers && { headers }) };
}

function commandEntry(raw: Json): McpEntry {
  const args = Array.isArray(raw.args)
    ? raw.args.filter((a): a is string => typeof a === "string")
    : [];
  const env = strings(raw.env);
  return {
    command: raw.command as string,
    ...(args.length && { args }),
    ...(env && { env }),
  };
}

export function toAdapterEntry(raw: unknown): McpEntry | undefined {
  if (!isObject(raw) || raw.disabled === true || raw.enabled === false) {
    return undefined;
  }
  if (typeof raw.url === "string") return urlEntry(raw);
  if (typeof raw.command === "string" && raw.command) return commandEntry(raw);
  return undefined;
}

function servers(map: unknown): Record<string, McpEntry> {
  if (!isObject(map)) return {};
  return Object.fromEntries(
    Object.entries(map).flatMap(([name, raw]) => {
      const entry = toAdapterEntry(raw);
      return entry ? [[name, entry]] : [];
    }),
  );
}

async function readJson(path: string): Promise<Json | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function readToml(path: string): Promise<Json | undefined> {
  try {
    return parseToml(await readFile(path, "utf8")) as Json;
  } catch {
    return undefined;
  }
}

async function claudeCodeSources(
  home: string,
  cwd: string | undefined,
): Promise<ImportSource[]> {
  const claude = await readJson(join(home, ".claude.json"));
  const projects = isObject(claude?.projects) ? claude.projects : {};
  const localServers = (folder: string) => {
    const p = projects[folder];
    return servers(isObject(p) && p.mcpServers);
  };
  const projectSources: ImportSource[] = [];
  if (cwd) {
    projectSources.push(
      // Claude Code's "local" scope: this folder, kept in ~/.claude.json.
      {
        id: "claude-code-local",
        app: "Claude Code",
        scope: "project",
        servers: localServers(cwd),
      },
      // Claude Code's "project" scope, shared with the repo.
      {
        id: "project-mcp-json",
        app: "Claude Code",
        scope: "project",
        servers: servers((await readJson(join(cwd, ".mcp.json")))?.mcpServers),
      },
    );
  }
  return [
    {
      id: "claude-code",
      app: "Claude Code",
      scope: "user",
      servers: servers(claude?.mcpServers),
    },
    ...projectSources,
    ...Object.keys(projects)
      .filter((folder) => folder !== cwd)
      .map((folder): ImportSource => ({
        id: `claude-code-local:${folder}`,
        app: "Claude Code",
        scope: "project",
        folder,
        servers: localServers(folder),
      })),
  ];
}

async function cursorSources(
  home: string,
  cwd: string | undefined,
): Promise<ImportSource[]> {
  const sources: ImportSource[] = [
    {
      id: "cursor",
      app: "Cursor",
      scope: "user",
      servers: servers(
        (await readJson(join(home, ".cursor", "mcp.json")))?.mcpServers,
      ),
    },
  ];
  if (cwd) {
    sources.push({
      id: "cursor-project",
      app: "Cursor",
      scope: "project",
      servers: servers(
        (await readJson(join(cwd, ".cursor", "mcp.json")))?.mcpServers,
      ),
    });
  }
  return sources;
}

async function codexSource(home: string): Promise<ImportSource> {
  return {
    id: "codex",
    app: "Codex",
    scope: "user",
    servers: servers(
      (await readToml(join(home, ".codex", "config.toml")))?.mcp_servers,
    ),
  };
}

async function claudeDesktopSource(home: string): Promise<ImportSource> {
  const configPath = join(
    home,
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json",
  );
  return {
    id: "claude-desktop",
    app: "Claude Desktop",
    scope: "user",
    servers: servers((await readJson(configPath))?.mcpServers),
  };
}

/**
 * Every other app's MCP servers found in `home`, and for the open folder
 * `cwd` if any. Sources with no usable servers are left out.
 */
export async function findImports(
  home: string,
  cwd: string | undefined,
): Promise<ImportSource[]> {
  const sources = [
    ...(await claudeCodeSources(home, cwd)),
    ...(await cursorSources(home, cwd)),
    await codexSource(home),
    await claudeDesktopSource(home),
  ];
  return sources.filter((s) => Object.keys(s.servers).length > 0);
}
