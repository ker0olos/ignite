/**
 * MCP servers live in pi-mcp-adapter's own config file, mcp.json in pi's agent
 * dir, in the format its README documents. The host edits the servers there;
 * fields the app doesn't show (settings, timeouts, filters) are kept as is.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  isServerCacheValid,
  loadMetadataCache,
} from "pi-mcp-adapter/metadata-cache";
import {
  mcpServerProblem,
  type McpServer,
  type McpServerConfig,
} from "../shared/hostProtocol.ts";

/** One server as pi-mcp-adapter reads it. */
export type McpEntry = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
  [field: string]: unknown;
};

export type McpFile = {
  mcpServers?: Record<string, McpEntry>;
  settings?: Record<string, unknown>;
  [field: string]: unknown;
};

/** Reads mcp.json; a missing file has no servers. */
export async function readMcpFile(path: string): Promise<McpFile> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error(`${path} isn't valid JSON.`);
  }
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    throw new Error(`${path} should hold a JSON object.`);
  }
  return file as McpFile;
}

/** Writes mcp.json readable only by the user: env and headers can hold secrets. */
export async function writeMcpFile(path: string, file: McpFile) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(file, null, 2) + "\n", { mode: 0o600 });
}

/**
 * What the adapter gets: the servers and its settings, nothing else. `imports`
 * and `claudePlugins` would make it read other apps' MCP configs.
 */
export function adapterConfig(file: McpFile) {
  return {
    mcpServers: file.mcpServers ?? {},
    ...(file.settings && { settings: file.settings }),
  };
}

/** The part of an entry the settings form edits. */
export function toConfig(entry: McpEntry): McpServerConfig {
  if (typeof entry.url === "string") {
    return { type: "http", url: entry.url, headers: entry.headers ?? {} };
  }
  return {
    type: "stdio",
    command: entry.command ?? "",
    args: entry.args ?? [],
    env: entry.env ?? {},
  };
}

// Fields that pick the transport; a saved form replaces all of them.
const TRANSPORT_FIELDS = [
  "type",
  "command",
  "args",
  "env",
  "url",
  "headers",
  "socket",
];

/** An entry for `config`, keeping `previous`'s other fields. */
export function toEntry(
  config: McpServerConfig,
  previous: McpEntry = {},
): McpEntry {
  const entry = Object.fromEntries(
    Object.entries(previous).filter(([k]) => !TRANSPORT_FIELDS.includes(k)),
  );
  const nonEmpty = (field: string, value: object) =>
    Object.keys(value).length > 0 ? { [field]: value } : {};
  if (config.type === "http") {
    return {
      ...entry,
      url: config.url,
      ...nonEmpty("headers", config.headers),
    };
  }
  return {
    ...entry,
    command: config.command,
    ...nonEmpty("args", config.args),
    ...nonEmpty("env", config.env),
  };
}

/** Tool names the adapter cached from the server's last connection. */
function cachedTools(name: string, entry: McpEntry): string[] {
  const cached = loadMetadataCache()?.servers[name];
  // A cache from before the entry changed describes another server.
  if (!cached || !isServerCacheValid(cached, entry)) return [];
  return cached.tools.map((t) => t.name);
}

/** Edits the servers in mcp.json, one change at a time. */
export function createMcpStore(path: string) {
  let queue: Promise<unknown> = Promise.resolve();

  function change(
    edit: (servers: Record<string, McpEntry>) => Record<string, McpEntry>,
  ): Promise<void> {
    const run = queue.then(async () => {
      const file = await readMcpFile(path);
      await writeMcpFile(path, {
        ...file,
        mcpServers: edit(file.mcpServers ?? {}),
      });
    });
    queue = run.catch(() => {});
    return run;
  }

  function existing(servers: Record<string, McpEntry>, name: string) {
    const entry = servers[name];
    if (!entry) throw new Error(`There is no server named ${name}.`);
    return entry;
  }

  return {
    async list(): Promise<Omit<McpServer, "status">[]> {
      const servers = (await readMcpFile(path)).mcpServers ?? {};
      return Object.entries(servers).map(([name, entry]) => {
        const enabled = entry.disabled !== true;
        return {
          name,
          enabled,
          config: toConfig(entry),
          tools: enabled ? cachedTools(name, entry) : [],
        };
      });
    },

    save(name: string, config: McpServerConfig, previousName?: string) {
      return change((servers) => {
        const previous =
          previousName === undefined
            ? undefined
            : existing(servers, previousName);
        const others = Object.keys(servers).filter((n) => n !== previousName);
        const problem = mcpServerProblem(name, config, others);
        if (problem) throw new Error(problem);
        const entry = toEntry(config, previous);
        if (previousName === undefined) return { ...servers, [name]: entry };
        // Renaming keeps the server's place in the file.
        return Object.fromEntries(
          Object.entries(servers).map(([n, e]) =>
            n === previousName ? [name, entry] : [n, e],
          ),
        );
      });
    },

    /** Adds entries as they are, skipping names that are already taken. */
    add(entries: Record<string, McpEntry>) {
      return change((servers) => ({
        ...servers,
        ...Object.fromEntries(
          Object.entries(entries).filter(([name]) => !(name in servers)),
        ),
      }));
    },

    remove(name: string) {
      return change((servers) => {
        existing(servers, name);
        return Object.fromEntries(
          Object.entries(servers).filter(([n]) => n !== name),
        );
      });
    },

    setEnabled(name: string, enabled: boolean) {
      return change((servers) => {
        const entry = { ...existing(servers, name) };
        delete entry.disabled;
        if (!enabled) entry.disabled = true;
        return { ...servers, [name]: entry };
      });
    },
  };
}

export type McpStore = ReturnType<typeof createMcpStore>;
