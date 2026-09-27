import {
  mcpServerProblem,
  type McpServer,
  type McpServerConfig,
  type McpServerStatus,
} from "../../shared/hostProtocol";

/** One name/value row of the form (an environment variable or a header). */
export type Pair = { key: string; value: string };

/** The add/edit form's fields, as typed. Arguments are one per line. */
export type McpForm = {
  name: string;
  type: McpServerConfig["type"];
  command: string;
  args: string;
  env: readonly Pair[];
  url: string;
  headers: readonly Pair[];
};

export const EMPTY_FORM: McpForm = {
  name: "",
  type: "http",
  command: "",
  args: "",
  env: [],
  url: "",
  headers: [],
};

const toPairs = (record: Record<string, string>): Pair[] =>
  Object.entries(record).map(([key, value]) => ({ key, value }));

/** The form for editing a saved server. */
export function toForm({ name, config }: McpServer): McpForm {
  return config.type === "stdio"
    ? {
        ...EMPTY_FORM,
        name,
        type: "stdio",
        command: config.command,
        args: config.args.join("\n"),
        env: toPairs(config.env),
      }
    : {
        ...EMPTY_FORM,
        name,
        url: config.url,
        headers: toPairs(config.headers),
      };
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Rows as a record, skipping empty ones; an error if a value has no name. */
function fromPairs(
  pairs: readonly Pair[],
  what: string,
): Record<string, string> | string {
  const record: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (!key.trim() && !value.trim()) continue;
    if (!key.trim()) return `Give each ${what} a name.`;
    record[key.trim()] = value.trim();
  }
  return record;
}

/**
 * The server a filled-in form describes, or what's wrong with it. `taken`
 * holds the other servers' names.
 */
export function readForm(
  form: McpForm,
  taken: readonly string[],
): { name: string; config: McpServerConfig } | { problem: string } {
  const name = form.name.trim();
  let config: McpServerConfig;
  if (form.type === "stdio") {
    const env = fromPairs(form.env, "variable");
    if (typeof env === "string") return { problem: env };
    config = {
      type: "stdio",
      command: form.command.trim(),
      args: lines(form.args),
      env,
    };
  } else {
    const headers = fromPairs(form.headers, "header");
    if (typeof headers === "string") return { problem: headers };
    config = { type: "http", url: form.url.trim(), headers };
  }
  const problem = mcpServerProblem(name, config, taken);
  return problem ? { problem } : { name, config };
}

const STATUS_LABELS: Record<McpServerStatus, string> = {
  connected: "Connected",
  idle: "Ready",
  checking: "Checking…",
  failed: "Couldn't connect",
  "needs-auth": "Needs sign-in",
  disabled: "Off",
};

/** A server's state in words; without a status no folder (session) is open. */
export function statusLabel(server: McpServer): string {
  // Servers connect on first use; "Ready" needs a past connection to vouch for it.
  if (server.status === "idle" && server.tools.length === 0) {
    return "Not connected yet";
  }
  if (server.status) return STATUS_LABELS[server.status];
  return server.enabled ? "Not running" : "Off";
}

/** Names of the servers in use that are waiting for the user to sign in. */
export function needingSignIn(servers: McpServer[] | null): string[] {
  return (servers ?? [])
    .filter((m) => m.enabled && m.status === "needs-auth")
    .map((m) => m.name);
}
