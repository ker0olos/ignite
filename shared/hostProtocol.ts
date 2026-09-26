/**
 * Wire protocol between the app (web view) and the pi host sidecar
 * (sidecar/main.ts): one JSON object per line, in both directions.
 * Auth prompt and event shapes mirror pi-ai's AuthPrompt / AuthEvent, minus
 * the AbortSignals that can't cross a process boundary.
 */
import type { AgentMessage, SessionEvent } from "./agentTypes.ts";

/**
 * pi's providers, plus "claude-code": the user's own Claude Code login, which
 * the pi-claude-bridge extension runs Claude models on (its models are pi's
 * "claude-bridge" provider).
 */
export type ProviderId =
  "claude-code" | "anthropic" | "openai-codex" | "openai";
export type AuthMethod = "oauth" | "api_key";

/** Every provider the app can connect, in display order. */
export const PROVIDERS: readonly ProviderId[] = [
  "claude-code",
  "anthropic",
  "openai-codex",
  "openai",
];

export type ProviderStatus = {
  id: ProviderId;
  connected: boolean;
  /** How it is connected: a subscription sign-in or an API key. */
  method?: AuthMethod;
  /** For claude-code: whether Claude Code is installed at all. */
  installed?: boolean;
  /** For openai-codex: signed in with the Codex CLI's login, not the app's. */
  viaCodex?: boolean;
};

export type AuthPromptData =
  | {
      type: "text" | "secret" | "manual_code";
      message: string;
      placeholder?: string;
    }
  | {
      type: "select";
      message: string;
      options: readonly { id: string; label: string; description?: string }[];
    };

export type AuthEventData =
  | {
      type: "info";
      message: string;
      links?: readonly { url: string; label?: string }[];
    }
  | { type: "auth_url"; url: string; instructions?: string }
  | {
      type: "device_code";
      userCode: string;
      verificationUri: string;
      intervalSeconds?: number;
      expiresInSeconds?: number;
    }
  | { type: "progress"; message: string };

/** pi's thinking levels (effort), from lowest to highest. */
export type ThinkingLevel =
  "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type ModelInfo = { provider: string; id: string; name: string };

/** The session's model and effort, with the choices pi offers for them. */
export type SessionState = {
  /** Models of every connected provider. */
  models: ModelInfo[];
  /** Unset until a provider is connected and a model chosen. */
  model?: ModelInfo;
  thinkingLevel: ThinkingLevel;
  /** Levels the current model supports; just "off" when it can't reason. */
  thinkingLevels: ThinkingLevel[];
};

/** What opening a folder's session returns: its settings and its history. */
export type OpenedSession = SessionState & {
  /** The conversation so far, when an earlier session is continued. */
  messages: AgentMessage[];
  /** Whether pi is still working on it. */
  running: boolean;
};

/** How to reach an MCP server: a local command (stdio) or a URL (HTTP). */
export type McpServerConfig =
  | {
      type: "stdio";
      command: string;
      args: string[];
      env: Record<string, string>;
    }
  | { type: "http"; url: string; headers: Record<string, string> };

/**
 * A server in the open folder's session. pi-mcp-adapter connects servers on
 * first use, so "idle" is the normal state of a working server.
 */
export type McpServerStatus =
  "connected" | "idle" | "failed" | "needs-auth" | "disabled";

/** A server saved in pi's mcp.json, with what the session knows about it. */
export type McpServer = {
  name: string;
  enabled: boolean;
  config: McpServerConfig;
  /** Unset while no folder is open: servers only run inside a session. */
  status?: McpServerStatus;
  /** Tool names from its last connection; empty until it has connected once. */
  tools: string[];
};

/** Messages the app sends. Those with an `id` get exactly one `response`. */
export type HostRequest =
  | { id: number; type: "status" }
  | {
      id: number;
      type: "login";
      provider: ProviderId;
      method: AuthMethod;
      /** For api_key sign-ins: the key, so no prompt round-trip is needed. */
      apiKey?: string;
    }
  | { id: number; type: "cancel_login" }
  | { id: number; type: "logout"; provider: ProviderId }
  /** Starts the agent session for a folder, replacing any previous one. */
  | { id: number; type: "open_session"; cwd: string }
  | { id: number; type: "session_state" }
  | { id: number; type: "set_model"; provider: string; modelId: string }
  | { id: number; type: "set_thinking_level"; level: ThinkingLevel }
  /** Resolves once pi has accepted the message; the run streams as events. */
  | { id: number; type: "prompt"; text: string }
  | { id: number; type: "abort" }
  | { id: number; type: "mcp_list" }
  /** Adds a server, or replaces `previousName` (which may differ, to rename). */
  | {
      id: number;
      type: "mcp_save";
      name: string;
      config: McpServerConfig;
      previousName?: string;
    }
  | { id: number; type: "mcp_remove"; name: string }
  | { id: number; type: "mcp_set_enabled"; name: string; enabled: boolean }
  | { id: number; type: "mcp_reconnect"; name: string }
  | { type: "prompt_answer"; promptId: number; value: string }
  | { type: "prompt_cancel"; promptId: number };

/** What each request resolves to. */
export type HostResponses = {
  status: ProviderStatus[];
  login: ProviderStatus;
  cancel_login: undefined;
  logout: ProviderStatus;
  open_session: OpenedSession;
  session_state: SessionState;
  set_model: SessionState;
  set_thinking_level: SessionState;
  prompt: undefined;
  abort: undefined;
  mcp_list: McpServer[];
  mcp_save: McpServer[];
  mcp_remove: McpServer[];
  mcp_set_enabled: McpServer[];
  mcp_reconnect: McpServer[];
};

/** Messages the sidecar sends. */
export type HostMessage =
  | { type: "ready" }
  | { type: "response"; id: number; ok: true; data?: unknown }
  | { type: "response"; id: number; ok: false; error: string }
  | { type: "auth_event"; event: AuthEventData }
  | { type: "auth_prompt"; promptId: number; prompt: AuthPromptData }
  /** The flow no longer needs this prompt (e.g. the browser callback won). */
  | { type: "auth_prompt_closed"; promptId: number }
  | { type: "session_event"; event: SessionEvent }
  /** A run pi accepted but couldn't carry out (e.g. no model or credentials). */
  | { type: "session_error"; error: string }
  /** The MCP servers changed (a status, or a saved change). */
  | { type: "mcp_servers"; servers: McpServer[] };

/**
 * pi interprets stored keys: a leading `!` runs a shell command and `$NAME`
 * reads an env var. A key typed by the user must stay literal, so refuse
 * those (real provider keys never contain them). Returns a message, or null.
 */
export function apiKeyProblem(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "Enter an API key.";
  if (trimmed.startsWith("!") || trimmed.includes("$")) {
    return "That doesn't look like an API key.";
  }
  if (/\s/.test(trimmed)) return "API keys can't contain spaces.";
  return null;
}

/**
 * Checks a server before it is saved; `taken` holds the other servers' names.
 * Names become part of tool names, so they stay simple. Returns a message, or
 * null.
 */
export function mcpServerProblem(
  name: string,
  config: McpServerConfig,
  taken: readonly string[],
): string | null {
  if (!name) return "Enter a name.";
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return "Use only letters, numbers, - and _ in the name.";
  }
  if (taken.includes(name)) return `There is already a server named ${name}.`;
  if (config.type === "stdio") {
    return config.command.trim() ? null : "Enter a command.";
  }
  return URL.canParse(config.url) &&
    ["http:", "https:"].includes(new URL(config.url).protocol)
    ? null
    : "Enter an http:// or https:// URL.";
}
