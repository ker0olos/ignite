import { GH_TOOL, GIT_TOOL } from "../../shared/git.ts";
import { ASK_TOOL } from "../../shared/questions.ts";

/**
 * pi-mcp-adapter's tools as the conversation shows them. The model reaches
 * MCP servers through `mcp` (search, describe, connect or call a tool), one
 * `mcp__<server>` tool per server, and `mcpScript` (JavaScript that makes
 * several calls).
 */
export type McpCall =
  | { kind: "call"; server?: string; tool: string; args: unknown }
  | { kind: "search"; query: string }
  | { kind: "describe"; tool: string }
  | { kind: "connect"; server: string }
  | { kind: "script"; code: string }
  /** Status, auth and other housekeeping. */
  | { kind: "other" };

const text = (value: unknown) => (typeof value === "string" ? value : "");

// The adapter accepts a tool's arguments as an object or a JSON string.
function toolArgs(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Reads an MCP tool call; null for tools that aren't the adapter's. */
export function mcpCall(
  name: string,
  args: Record<string, unknown>,
): McpCall | null {
  if (name === "mcpScript") return { kind: "script", code: text(args.code) };
  if (name.startsWith("mcp__")) {
    return {
      kind: "call",
      server: name.slice("mcp__".length),
      tool: text(args.tool),
      args: toolArgs(args.args),
    };
  }
  if (name !== "mcp") return null;
  if (args.tool) {
    return {
      kind: "call",
      server: text(args.server) || undefined,
      tool: text(args.tool),
      args: toolArgs(args.args),
    };
  }
  if (args.search) return { kind: "search", query: text(args.search) };
  if (args.describe) return { kind: "describe", tool: text(args.describe) };
  if (args.connect) return { kind: "connect", server: text(args.connect) };
  return { kind: "other" };
}

const READS = new Set(
  "get list search find read fetch describe view show lookup count check status inspect preview poll timeline".split(
    " ",
  ),
);
// `query`, `sql` and the like run whatever they're given, so they ask too.
const CHANGES = new Set(
  "create update delete remove add set send post put patch edit write move rename archive attach upload download import export execute exec eval run call invoke query sql shell script generate install merge close assign invite start stop cancel publish deploy apply reply comment toggle enable disable reset restore submit approve reject insert upsert drop push transfer buy pay purchase sign revoke trigger save duplicate copy kill pause unpause request change mark complete resolve replace commit share grant schedule clear notify modify mutate sync clone fork upgrade migrate seed truncate purge destroy terminate activate deactivate lock unlock subscribe unsubscribe follow unfollow reserve transition convert fill click press navigate login logout".split(
    " ",
  ),
);

/**
 * Whether an MCP tool reads only, judged by the verbs in its name
 * (`clickup_get_list` yes, `clickup_create_comment` no); unknown ones don't.
 */
// ponytail: names only, so a change verb missing from CHANGES slips through; servers' readOnlyHint isn't in the adapter's cache.
function readsOnly(tool: string): boolean {
  const words = tool
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return words.some((w) => READS.has(w)) && !words.some((w) => CHANGES.has(w));
}

/**
 * Why Auto asks before an MCP call (it may change something), or null.
 * `direct`: the tool is one of the adapter's direct tools (`<server>_<tool>`).
 */
export function mcpReason(
  name: string,
  args: Record<string, unknown>,
  direct = false,
): string | null {
  const call = direct
    ? { kind: "call" as const, tool: name }
    : mcpCall(name, args);
  if (call?.kind === "script") return "Runs MCP calls from a script";
  if (call?.kind !== "call" || !call.tool || readsOnly(call.tool)) return null;
  return `May make changes: ${call.tool}`;
}

/**
 * Whether a tool is one of the adapter's direct tools, which are named by
 * server (`clickup_create_task`); `tools` is pi's getAllTools().
 */
export function isMcpDirect(
  name: string,
  tools: { name: string; sourceInfo: { path: string } }[],
): boolean {
  if (mcpCall(name, {})) return false;
  const tool = tools.find((t) => t.name === name);
  return /[/\\]mcpExtension\.ts$/.test(tool?.sourceInfo.path ?? "");
}

/** A tool's arguments as YAML-like lines, multi-line strings (SQL, scripts) kept readable. */
export function argsText(args: unknown): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return typeof args === "string" ? args : JSON.stringify(args, null, 2);
  }
  return Object.entries(args)
    .map(([key, value]) => {
      if (typeof value !== "string") return `${key}: ${JSON.stringify(value)}`;
      if (!value.includes("\n")) return `${key}: ${value}`;
      return `${key}: |\n${value.replace(/^/gm, "  ")}`;
    })
    .join("\n");
}

// Built-in tools whose row already shows what they'd do (path, pattern, review).
const SHOWN = new Set([
  "read",
  "write",
  "edit",
  "ls",
  "grep",
  "find",
  GIT_TOOL,
  GH_TOOL,
  ASK_TOOL,
]);

function yaml(args: unknown) {
  const code = argsText(args);
  return code ? { code, lang: "yaml" } : null;
}

/** What a waiting call's approval shows of its arguments, or null when its row already does. */
export function approvalArgs(name: string, args: Record<string, unknown>) {
  const mcp = mcpCall(name, args);
  if (mcp?.kind === "script") return { code: mcp.code, lang: "js" };
  // The server tool's own arguments: a `reason` there is the server's, not the agent's.
  if (mcp?.kind === "call") return yaml(mcp.args);
  if (mcp || SHOWN.has(name)) return null;
  return yaml(
    Object.fromEntries(Object.entries(args).filter(([k]) => k !== "reason")),
  );
}
