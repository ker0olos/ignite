/**
 * Wire protocol between the app (web view) and the pi host sidecar
 * (sidecar/main.ts): one JSON object per line, in both directions.
 * Auth prompt and event shapes mirror pi-ai's AuthPrompt / AuthEvent, minus
 * the AbortSignals that can't cross a process boundary.
 */
import type { AgentMessage, ImageContent, SessionEvent } from "./agentTypes.ts";
import type { GitReview } from "./git.ts";
import type { QuestionAnswer } from "./questions.ts";

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

/**
 * Whether the folder's own pi resources (`.pi/` extensions, skills, settings)
 * load. "ask": it has some and the user hasn't decided yet.
 */
export type ProjectTrust = "trusted" | "untrusted" | "ask";

/** Manual asks before every tool call; Auto only before risky ones. */
export type ApprovalMode = "auto" | "manual";

/** A tool call waiting for the user to approve or deny it. */
export type ApprovalRequest = {
  toolCallId: string;
  /** Why Auto stopped for it; unset in Manual, which asks for everything. */
  reason?: string;
  /** What a commit or push would change. */
  review?: GitReview;
};

/** What opening a folder's session returns: its settings and its history. */
export type OpenedSession = SessionState & {
  /** The conversation's id; a folder can have several. */
  session: string;
  trust: ProjectTrust;
  /** The conversation so far, when an earlier session is continued. */
  messages: AgentMessage[];
  /** Whether pi is still working on it. */
  running: boolean;
  /** Why the session isn't on the model the user last chose. */
  modelWarning?: string;
  /** Tool calls asked while the folder wasn't shown, still waiting. */
  approvals: ApprovalRequest[];
};

/** A folder open in this window, which may be working while another is shown. */
export type ProjectStatus = {
  cwd: string;
  running: boolean;
  /** A tool call waits for the user. */
  waiting: boolean;
};

/** One of a folder's open conversations. */
export type AgentStatus = ProjectStatus & { session: string };

/** A conversation pi saved for a folder. */
export type SavedSession = {
  id: string;
  /** Its name, or else its first message. */
  title: string;
  /** Milliseconds since the epoch. */
  modified: number;
  messageCount: number;
  /** Whether it's open in this window. */
  open: boolean;
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
  | "connected"
  | "idle"
  /** Being connected once after it was set up, to learn its real status. */
  | "checking"
  | "failed"
  | "needs-auth"
  | "disabled";

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

/** Servers the MCP settings offer to add in one click. */
export type McpCatalog = {
  presets: {
    id: string;
    name: string;
    summary: string;
    /** Signs in with OAuth, which the app can't do yet. */
    signIn: boolean;
    /** A server with this name is already saved. */
    added: boolean;
  }[];
  /** Other apps' servers found on this Mac. */
  sources: {
    id: string;
    app: string;
    /** "project": set up in that app for the open folder only. */
    scope: "user" | "project";
    servers: {
      name: string;
      /** The command or URL, to recognise it by. */
      target: string;
      added: boolean;
    }[];
  }[];
};

/** Something claude-mem recorded, as its worker lists it. */
export type MemoryObservation = {
  id: number;
  /** claude-mem's kind: "bugfix", "feature", "decision", "discovery"… */
  type: string;
  title: string;
  subtitle?: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  /** The tool that recorded it: "claude", "codex", this app's name… */
  platform: string;
};

/** claude-mem on this Mac, for the open folder if any. */
export type MemoryStatus = {
  state: "not-installed" | "stopped" | "excluded" | "running";
  /** The worker's web viewer, while it runs. */
  viewerUrl?: string;
  /** The open folder's latest observations, newest first. */
  observations: MemoryObservation[];
};

/** The commit the app runs from; `date` is ISO 8601. */
export type AppVersion = { sha: string; date: string; subject: string };

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
  /**
   * Shows one of a folder's conversations, opening it unless it's open.
   * Without `session`: the one last shown, else the most recent saved one.
   */
  | { id: number; type: "open_session"; cwd: string; session?: string }
  /** Starts another, empty conversation in the folder and shows it. */
  | { id: number; type: "new_session"; cwd: string }
  /**
   * Ends a conversation, or without `session` all of the folder's; their
   * waiting tool calls are denied. Saved conversations stay.
   */
  | { id: number; type: "close_session"; cwd: string; session?: string }
  /** Ends the shown conversation and starts an empty one in its place; it stays saved. */
  | { id: number; type: "clear_session" }
  /** The folder's saved conversations, newest first. */
  | { id: number; type: "list_sessions"; cwd: string }
  | { id: number; type: "session_state" }
  | { id: number; type: "set_model"; provider: string; modelId: string }
  | { id: number; type: "set_thinking_level"; level: ThinkingLevel }
  /** Resolves once pi has accepted the message; the run streams as events. */
  | { id: number; type: "prompt"; text: string; images?: ImageContent[] }
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
  /** Runs the server's OAuth sign-in in the browser; resolves when it ends. */
  | { id: number; type: "mcp_sign_in"; name: string }
  /** `cwd`: the open folder, whose project servers other apps may have. */
  | { id: number; type: "mcp_catalog"; cwd?: string }
  | { id: number; type: "mcp_add_preset"; preset: string }
  /** Copies servers from another app's config (see McpCatalog.sources). */
  | {
      id: number;
      type: "mcp_import";
      source: string;
      names: string[];
      cwd?: string;
    }
  | { id: number; type: "memory_status"; cwd?: string }
  /** The memory setting was saved; reloads the session to add or drop cmem's tools. */
  | { id: number; type: "memory_changed" }
  /** Saves the folder's trust; trusting it reloads the session. */
  | { id: number; type: "set_trust"; cwd: string; trusted: boolean }
  /** One file's diff in a review's range (see GitReview). */
  | { id: number; type: "git_diff"; repo: string; range: string; path: string }
  | { id: number; type: "app_version" }
  /** Pulls the latest code; `updated` is false when it was already current. */
  | { id: number; type: "app_update" }
  | { type: "prompt_answer"; promptId: number; value: string }
  | { type: "prompt_cancel"; promptId: number }
  /** `answers` replies to an ask_user call; declining one lets the agent decide. */
  | {
      type: "approval_answer";
      toolCallId: string;
      approved: boolean;
      answers?: QuestionAnswer[];
    };

/** What each request resolves to. */
export type HostResponses = {
  status: ProviderStatus[];
  login: ProviderStatus;
  cancel_login: undefined;
  logout: ProviderStatus;
  open_session: OpenedSession;
  new_session: OpenedSession;
  close_session: undefined;
  clear_session: OpenedSession;
  list_sessions: SavedSession[];
  session_state: SessionState;
  set_model: SessionState;
  set_thinking_level: SessionState;
  prompt: undefined;
  abort: undefined;
  mcp_list: McpServer[];
  mcp_save: McpServer[];
  mcp_remove: McpServer[];
  mcp_set_enabled: McpServer[];
  mcp_sign_in: McpServer[];
  mcp_catalog: McpCatalog;
  mcp_add_preset: McpServer[];
  mcp_import: McpServer[];
  memory_status: MemoryStatus;
  memory_changed: undefined;
  set_trust: undefined;
  git_diff: string;
  app_version: AppVersion;
  app_update: { updated: boolean };
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
  | { type: "session_event"; session: string; event: SessionEvent }
  /** A run pi accepted but couldn't carry out (e.g. no model or credentials). */
  | { type: "session_error"; session: string; error: string }
  /** An extension reported a problem (e.g. an MCP sign-in that failed). */
  | { type: "extension_error"; message: string }
  /** A tool call waits for the user (see ApprovalMode). */
  | { type: "approval_request"; session: string; request: ApprovalRequest }
  /** A conversation opened, closed, started or finished a run, or began or stopped waiting. */
  | { type: "agents"; agents: AgentStatus[] }
  /** The MCP servers changed (a status, or a saved change). */
  | { type: "mcp_servers"; servers: McpServer[] };
