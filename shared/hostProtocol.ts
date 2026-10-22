/**
 * Wire protocol between the app (web view) and the pi host sidecar
 * (sidecar/main.ts): one JSON object per line, in both directions.
 */
import type { AgentMessage, ImageContent, SessionEvent } from "./agentTypes.ts";
import type * as Auth from "./auth.ts";
import type {
  AgentStatus,
  ChildRequest,
  ChildResponses,
} from "./agentStatus.ts";
import type { QueueKind, QueuedMessage, Unqueue } from "./queue.ts";
import type { RewindRequest, RewindResponses } from "./rewind.ts";
import type { GitRequest, GitResponses, GitReview } from "./git.ts";
import type { MemoryStatus } from "./memory.ts";
import type {
  ModelChoiceRequest,
  ModelChoiceResponses,
} from "./modelChoice.ts";
import type {
  CommandSearch,
  CommandSearchResult,
  NewSession,
  SessionDetails,
} from "./conversations.ts";
import type * as Lessons from "./lessons.ts";
import type * as Reflector from "./reflector.ts";
import type * as Fallback from "./fallbackKeys.ts";
import type { AppUpdateRequest, AppUpdateResponses } from "./appUpdate.ts";
import type { QuestionAnswer } from "./questions.ts";
import type { McpCatalog } from "./mcpCatalog.ts";
import type { McpServer, McpServerConfig } from "./mcpServers.ts";
import type { SkillInfo, SkillRequest, SkillResponses } from "./skills.ts";
import type { RemoteEvent, RemoteInvoke, RemoteStatus } from "./remote.ts";
import type { Task, TaskRequest, TaskResponses } from "./tasks.ts";
import type {
  TerminalMessage,
  TerminalRequest,
  TerminalResponses,
} from "./terminal.ts";

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
  /** Skills the session loaded, which `/name` runs. */
  skills: SkillInfo[];
  /** The user picked Router, so the router picks the model and effort for the next message. */
  routeNext?: boolean;
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
  /** What the sandbox blocked that the user may always allow (a host, socket, path, or a program to run outside it). */
  allow?: string;
};

/** What opening a folder's session returns: its settings and its history. */
export type OpenedSession = SessionState & {
  /** The conversation's id; a folder can have several. */
  session: string;
  /** Where its agent works: its own git worktree, or the folder itself. */
  workdir: string;
  trust: ProjectTrust;
  /** The conversation so far; left out when the app already follows it (`known`). */
  messages?: AgentMessage[];
  /** Whether pi is still working on it, or the router on its first message. */
  running: boolean;
  /** The first message the router is still reading, not yet in `messages`. */
  routing?: Extract<SessionEvent, { type: "routing_start" }>["message"];
  /** Why the session isn't on the model the user last chose. */
  modelWarning?: string;
  /** Tool calls asked while the folder wasn't shown, still waiting. */
  approvals: ApprovalRequest[];
  /** Running tool calls' latest progress events, not yet in `messages`. */
  toolRuns?: SessionEvent[];
  /** Messages sent mid-run, not yet delivered. */
  queue: { steering: string[]; followUp: string[] };
};

/** The commit the app runs from; `date` is ISO 8601. */
export type AppVersion = { sha: string; date: string; subject: string };

/**
 * Messages the app sends. Those with an `id` get exactly one `response`.
 * `session`, where a request takes one, names the conversation it's for
 * (else the shown one), so it can't land in another shown since it was sent.
 */
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
   * Without `session`: the folder's last shown open one, else null (showing a
   * folder never starts a conversation).
   */
  /** `known`: a conversation whose events the app has followed since it opened, so its messages aren't sent again. */
  | {
      id: number;
      type: "open_session";
      cwd: string;
      session?: string;
      known?: string;
    }
  /** Starts another conversation in the folder and shows it: empty, or a copy of one (see ForkSession). */
  | NewSession
  /**
   * Ends a conversation, or without `session` all of the folder's; their
   * waiting tool calls are denied. Saved conversations stay.
   */
  | { id: number; type: "close_session"; cwd: string; session?: string }
  /**
   * A conversation's messages, read from its file (or its running session)
   * without starting it, so it shows while it starts.
   */
  | {
      id: number;
      type: "read_session";
      cwd: string;
      session: string;
      /** Only about the last this many messages. */
      tail?: number;
    }
  | ({ id: number; type: "command_search" } & CommandSearch)
  /** What a saved conversation did: model, cost, files… */
  | { id: number; type: "session_details"; cwd: string; session: string }
  | ModelChoiceRequest
  /** Resolves once pi has accepted the message; the run streams as events. */
  | {
      id: number;
      type: "prompt";
      text: string;
      images?: ImageContent[];
      session?: string;
      /** While it works; `steer` when unset. */
      queue?: QueueKind;
    }
  | RewindRequest
  /** Stops the run; resolves to the queued messages, taken back. */
  | { id: number; type: "abort"; session?: string }
  /** Summarizes the conversation's older messages (`/compact`), optionally as `instructions` say; resolves once done. */
  | { id: number; type: "compact"; session?: string; instructions?: string }
  /** Resolves to the message, or null when it was already delivered. */
  | ({ id: number; type: "unqueue" } & Unqueue)
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
  | SkillRequest
  | Lessons.LessonRequest
  | Reflector.ReflectorRequest
  | Fallback.FallbackKeyRequest
  /** The folder's memories for Settings: its latest, or `query`'s best matches, of `kind` only when given. */
  | {
      id: number;
      type: "memory_status";
      cwd?: string;
      query?: string;
      kind?: string;
    }
  /** The memory setting was saved; reloads the session to add or drop the memory tools. */
  | { id: number; type: "memory_changed" }
  /** Saves the folder's trust; trusting it reloads the session. */
  | { id: number; type: "set_trust"; cwd: string; trusted: boolean }
  | ChildRequest
  | GitRequest
  | TaskRequest
  | TerminalRequest
  | AppUpdateRequest
  | Auth.AuthPromptAnswer
  /** Sent every second while the page runs (sidecar/hangWatch.ts). */
  | { type: "heartbeat"; visible: boolean }
  /**
   * `answers` replies to an ask_user call; declining one lets the agent decide.
   * `always` also allows the request's `allow` from now on.
   */
  | {
      type: "approval_answer";
      toolCallId: string;
      approved: boolean;
      answers?: QuestionAnswer[];
      always?: boolean;
    };

export type { AgentStatus };
export type {
  McpServer,
  McpServerConfig,
  McpServerStatus,
} from "./mcpServers.ts";

/** What each request resolves to. */
export type HostResponses = SkillResponses &
  Lessons.LessonResponses &
  Reflector.ReflectorResponses &
  Fallback.FallbackKeyResponses &
  AppUpdateResponses &
  RewindResponses &
  TaskResponses &
  TerminalResponses &
  GitResponses &
  ModelChoiceResponses &
  ChildResponses & {
    status: ProviderStatus[];
    login: ProviderStatus;
    cancel_login: undefined;
    logout: ProviderStatus;
    open_session: OpenedSession | null;
    new_session: OpenedSession;
    close_session: undefined;
    read_session: AgentMessage[];
    session_details: SessionDetails;
    command_search: CommandSearchResult;
    prompt: undefined;
    abort: QueuedMessage[];
    compact: undefined;
    unqueue: QueuedMessage | null;
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
  };

/** Messages the sidecar sends. */
export type HostMessage =
  | { type: "ready" }
  | { type: "response"; id: number; ok: true; data?: unknown }
  | { type: "response"; id: number; ok: false; error: string }
  | { type: "auth_event"; event: Auth.AuthEventData }
  | { type: "auth_prompt"; promptId: number; prompt: Auth.AuthPromptData }
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
  /** A folder's tasks changed: saved by a window, or updated by an agent. */
  | { type: "tasks"; cwd: string; tasks: Task[] }
  /** Check for updates found one and is building it, to run on the next start. */
  | { type: "app_update_installing" }
  /** The MCP servers changed (a status, or a saved change). */
  | { type: "mcp_servers"; servers: McpServer[] }
  /** A terminal printed, or its shell exited. */
  | TerminalMessage
  /** Remote access, for the main window only (see shared/remote.ts). */
  | RemoteInvoke
  | RemoteEvent
  | RemoteStatus;
