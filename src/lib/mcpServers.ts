import {
  mcpServerProblem,
  type McpServer,
  type McpServerConfig,
  type McpServerStatus,
} from "../../shared/hostProtocol";

/** The add/edit form's fields, as typed. Lists are one entry per line. */
export type McpForm = {
  name: string;
  type: McpServerConfig["type"];
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
};

export const EMPTY_FORM: McpForm = {
  name: "",
  type: "http",
  command: "",
  args: "",
  env: "",
  url: "",
  headers: "",
};

const formatPairs = (pairs: Record<string, string>, separator: string) =>
  Object.entries(pairs)
    .map(([key, value]) => `${key}${separator}${value}`)
    .join("\n");

/** The form for editing a saved server. */
export function toForm({ name, config }: McpServer): McpForm {
  return config.type === "stdio"
    ? {
        ...EMPTY_FORM,
        name,
        type: "stdio",
        command: config.command,
        args: config.args.join("\n"),
        env: formatPairs(config.env, "="),
      }
    : {
        ...EMPTY_FORM,
        name,
        url: config.url,
        headers: formatPairs(config.headers, ": "),
      };
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** `KEY=value` (env) or `Name: value` (headers) lines; an error names the bad line. */
function parsePairs(
  text: string,
  separator: "=" | ":",
  what: string,
): Record<string, string> | string {
  const pairs: Record<string, string> = {};
  for (const line of lines(text)) {
    const at = line.indexOf(separator);
    const key = line.slice(0, at).trim();
    if (at === -1 || !key) {
      return `Write each ${what} as ${separator === "=" ? "NAME=value" : "Name: value"}.`;
    }
    pairs[key] = line.slice(at + 1).trim();
  }
  return pairs;
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
    const env = parsePairs(form.env, "=", "variable");
    if (typeof env === "string") return { problem: env };
    config = {
      type: "stdio",
      command: form.command.trim(),
      args: lines(form.args),
      env,
    };
  } else {
    const headers = parsePairs(form.headers, ":", "header");
    if (typeof headers === "string") return { problem: headers };
    config = { type: "http", url: form.url.trim(), headers };
  }
  const problem = mcpServerProblem(name, config, taken);
  return problem ? { problem } : { name, config };
}

const STATUS_LABELS: Record<McpServerStatus, string> = {
  connected: "Connected",
  idle: "Ready",
  failed: "Couldn't connect",
  "needs-auth": "Needs sign-in",
  disabled: "Off",
};

/** A server's state in words; without a status no folder (session) is open. */
export function statusLabel(server: McpServer): string {
  if (server.status) return STATUS_LABELS[server.status];
  return server.enabled ? "Not running" : "Off";
}

/** What the server runs or where it is, in one line. */
export function describeServer({ config }: McpServer): string {
  return config.type === "stdio"
    ? [config.command, ...config.args].join(" ")
    : config.url;
}

/** Its tools as a count. */
export function toolSummary(tools: readonly string[]): string {
  if (tools.length === 0) return "No tools yet";
  return `${tools.length} ${tools.length === 1 ? "tool" : "tools"}`;
}
