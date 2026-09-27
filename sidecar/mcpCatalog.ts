/**
 * Servers the MCP settings offer to add in one click: well-known presets, and
 * servers already set up in other apps on this Mac (Claude Code, Cursor,
 * Codex, Claude Desktop), user-wide or for the open folder. Importing copies
 * an entry into the app's mcp.json; the other apps' files are only read.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KNOWN_SERVER_PRESETS } from "pi-mcp-adapter/config";
import { parse as parseToml } from "smol-toml";
import type { McpEntry } from "./mcpConfig.ts";

export type Preset = {
  id: string;
  name: string;
  summary: string;
  entry: McpEntry;
};

// ponytail: hand-picked on top of the adapter's list; entries checked against
// the servers' docs in Sept 2026 (npm @playwright/mcp, live OAuth endpoints).
const EXTRA_PRESETS: Preset[] = [
  {
    id: "playwright",
    name: "Playwright",
    summary: "Drive a browser to test and debug web apps.",
    entry: { command: "npx", args: ["-y", "@playwright/mcp@0.0.82"] },
  },
  {
    id: "sentry",
    name: "Sentry",
    summary: "Look into errors and issues in your Sentry projects.",
    entry: { url: "https://mcp.sentry.dev/mcp", auth: "oauth" },
  },
  {
    id: "supabase",
    name: "Supabase",
    summary: "Manage your Supabase projects, database and functions.",
    entry: { url: "https://mcp.supabase.com/mcp", auth: "oauth" },
  },
  {
    id: "linear",
    name: "Linear",
    summary: "Find and update Linear issues and projects.",
    entry: { url: "https://mcp.linear.app/mcp", auth: "oauth" },
  },
];

/** pi-mcp-adapter's presets, then ours. */
export const PRESETS: readonly Preset[] = [
  ...KNOWN_SERVER_PRESETS.map(({ id, name, summary, entry }) => ({
    id,
    name,
    summary,
    entry: entry as McpEntry,
  })),
  ...EXTRA_PRESETS,
];

/** Whether a server signs in with OAuth (the app can't do that yet). */
export const needsSignIn = (entry: McpEntry) => entry.auth === "oauth";

/** An app's servers found on this Mac. */
export type ImportSource = {
  id: string;
  app: string;
  /** "project": set up for the open folder only. */
  scope: "user" | "project";
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
export function toAdapterEntry(raw: unknown): McpEntry | undefined {
  if (!isObject(raw) || raw.disabled === true || raw.enabled === false) {
    return undefined;
  }
  if (typeof raw.url === "string") {
    const headers = strings(raw.headers) ?? strings(raw.http_headers);
    return { url: raw.url, ...(headers && { headers }) };
  }
  if (typeof raw.command === "string" && raw.command) {
    const args = Array.isArray(raw.args)
      ? raw.args.filter((a): a is string => typeof a === "string")
      : [];
    const env = strings(raw.env);
    return {
      command: raw.command,
      ...(args.length && { args }),
      ...(env && { env }),
    };
  }
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

/**
 * Every other app's MCP servers found in `home`, and for the open folder
 * `cwd` if any. Sources with no usable servers are left out.
 */
export async function findImports(
  home: string,
  cwd: string | undefined,
): Promise<ImportSource[]> {
  const claude = await readJson(join(home, ".claude.json"));
  const claudeProject =
    cwd && isObject(claude?.projects) ? claude.projects[cwd] : undefined;
  const sources: (ImportSource | false | undefined)[] = [
    {
      id: "claude-code",
      app: "Claude Code",
      scope: "user",
      servers: servers(claude?.mcpServers),
    },
    // Claude Code's "local" scope: this folder, kept in ~/.claude.json.
    !!cwd && {
      id: "claude-code-local",
      app: "Claude Code",
      scope: "project",
      servers: servers(isObject(claudeProject) && claudeProject.mcpServers),
    },
    // Claude Code's "project" scope, shared with the repo.
    !!cwd && {
      id: "project-mcp-json",
      app: "Claude Code",
      scope: "project",
      servers: servers((await readJson(join(cwd, ".mcp.json")))?.mcpServers),
    },
    {
      id: "cursor",
      app: "Cursor",
      scope: "user",
      servers: servers(
        (await readJson(join(home, ".cursor", "mcp.json")))?.mcpServers,
      ),
    },
    !!cwd && {
      id: "cursor-project",
      app: "Cursor",
      scope: "project",
      servers: servers(
        (await readJson(join(cwd, ".cursor", "mcp.json")))?.mcpServers,
      ),
    },
    {
      id: "codex",
      app: "Codex",
      scope: "user",
      servers: servers(
        (await readToml(join(home, ".codex", "config.toml")))?.mcp_servers,
      ),
    },
    {
      id: "claude-desktop",
      app: "Claude Desktop",
      scope: "user",
      servers: servers(
        (
          await readJson(
            join(
              home,
              "Library",
              "Application Support",
              "Claude",
              "claude_desktop_config.json",
            ),
          )
        )?.mcpServers,
      ),
    },
  ];
  return sources.filter(
    (s): s is ImportSource => !!s && Object.keys(s.servers).length > 0,
  );
}
