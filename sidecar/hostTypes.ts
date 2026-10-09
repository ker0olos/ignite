import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { StreamFn } from "./compactProgress.ts";
import type {
  ModelInfo,
  ThinkingLevel,
  AuthEventData,
  AuthMethod,
  AuthPromptData,
  HostMessage,
} from "../shared/hostProtocol.ts";
import type { SubagentStatus } from "../shared/agentStatus.ts";
import type { SavedSession, SessionDetails } from "../shared/conversations.ts";
import type {
  AgentMessage,
  ImageContent,
  SessionEvent,
  ToolResultMessage,
  UserMessage,
} from "../shared/agentTypes.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import type { ClaudeCode } from "./claudeCode.ts";
import type { McpStore } from "./mcpConfig.ts";
import type { ImportSource } from "./mcpCatalog.ts";
import type { Preset } from "./mcpPresets.ts";
import type { TrustStore } from "./trust.ts";
import type { SkillStore } from "./skillStore.ts";
import type { TaskStore } from "./taskStore.ts";
import type { Workspaces } from "./worktrees.ts";
import type { DraftPick } from "./draftSession.ts";
import type { createSearch } from "./search.ts";

/** What the MCP settings offer to add in one click. */
export type McpCatalogSource = {
  presets: readonly Preset[];
  /** Other apps' servers, including the open folder's when `cwd` is set. */
  findImports(cwd: string | undefined): Promise<ImportSource[]>;
};

/** Sign-ins the app borrows from other tools on this Mac. */
export type LocalLogins = {
  claudeCode: ClaudeCode;
  /** Whether openai-codex runs on the Codex CLI's login. */
  usesCodexLogin(): Promise<boolean>;
};

type Interaction = {
  signal?: AbortSignal;
  prompt(prompt: AuthPromptData & { signal?: AbortSignal }): Promise<string>;
  notify(event: AuthEventData): void;
};

/** The slice of pi's ModelRuntime the host needs; tests pass a fake. */
export type Runtime = {
  checkAuth(providerId: string): Promise<{ type: AuthMethod } | undefined>;
  login(
    providerId: string,
    type: AuthMethod,
    interaction: Interaction,
  ): Promise<unknown>;
  logout(providerId: string): Promise<void>;
};

/** The slice of pi's AgentSession the host needs; tests pass a fake. */
export type Session = {
  /** Its own, since each session registers its own pi-claude-bridge. */
  readonly modelRuntime: {
    getAvailable(): Promise<readonly ModelInfo[]>;
    getAuth(
      model: ModelInfo,
    ): Promise<{ auth: { apiKey?: string; headers?: unknown } } | undefined>;
  } & Pick<AgentSession["modelRuntime"], "getModels" | "completeSimple">;
  readonly model: ModelInfo | undefined;
  readonly thinkingLevel: ThinkingLevel;
  getAvailableThinkingLevels(): ThinkingLevel[];
  readonly resourceLoader: {
    getSkills(): { skills: readonly { name: string; description: string }[] };
  };
  setModel(model: ModelInfo, options: { persist: boolean }): Promise<void>;
  setThinkingLevel(level: ThinkingLevel, options: { persist: boolean }): void;
  readonly messages: AgentMessage[];
  readonly agent: {
    state: { messages: AgentMessage[]; streamingMessage?: AgentMessage };
    /** Swapped while `/compact` runs, to read the summary's progress. */
    streamFunction: StreamFn;
  };
  readonly sessionManager: {
    appendMessage(message: ToolResultMessage): string;
  };
  sendCustomMessage(
    message: { customType: string; content: string; display: boolean },
    options: { deliverAs: "nextTurn" },
  ): Promise<void>;
  readonly isStreaming: boolean;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  prompt(
    text: string,
    options: { streamingBehavior?: "steer" | "followUp"; images?: unknown[] },
  ): Promise<void>;
  abort(): Promise<void>;
  /** Summarizes older messages; aborts a run first. Its outcome also arrives as compaction events. */
  compact(customInstructions?: string): Promise<unknown>;
  /** Queue a message whether or not a run is going; neither starts one. */
  steer(text: string, images?: ImageContent[]): Promise<void>;
  followUp(text: string, images?: ImageContent[]): Promise<void>;
  /** Empties both queues, returning their messages' text. */
  clearQueue(): { steering: string[]; followUp: string[] };
  getSteeringMessages(): readonly string[];
  getFollowUpMessages(): readonly string[];
  readonly pendingMessageCount: number;
  /** Reloads extensions, which re-reads mcp.json. */
  reload(): Promise<void>;
  /** Whether a reload loads the folder's own pi resources. */
  readonly settingsManager: { setProjectTrusted(trusted: boolean): void };
  readonly extensionRunner: {
    emit(event: { type: "session_shutdown"; reason: "quit" }): Promise<unknown>;
    getCommand(name: string): unknown;
  };
  dispose(): void;
  /** Set when the saved model never became available and another was used. */
  modelWarning?: string;
};

/** pi-mcp-adapter's status snapshot (its MCP_STATUS_EVENT), as far as it's read. */
export type McpStatusSnapshot = {
  servers: readonly { name: string; status: string }[];
};

/**
 * Opens the folder's saved conversation `id`, or starts an empty one with
 * that id, working in `workdir`; the adapter's status snapshots go to
 * `onMcpStatus`, tool calls waiting for the user to `onApproval`.
 */
export type OpenSession = (
  cwd: string,
  workdir: string,
  id: string,
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
  onApproval: (ask: ApprovalAsk) => void,
) => Promise<Session>;

/** Opens the session MCP servers are checked and signed into in; see mcpSession.ts. */
export type OpenMcpSession = (
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
) => Promise<Session>;

/** The conversations pi saved for each folder. */
export type SessionStore = {
  /** A new conversation id. */
  create(): string;
  /** The folder's conversations with at least one message, newest first, with all their text. */
  list(cwd: string): Promise<(SavedSession & { text: string })[]>;
  /** A saved conversation's messages; none if it has no file yet. */
  read(cwd: string, id: string): Promise<AgentMessage[]>;
  /** What's known of it beyond its messages: its branch, cmem's summary. */
  extras(
    cwd: string,
    id: string,
  ): Promise<Pick<SessionDetails, "branch" | "summary">>;
};

/**
 * One conversation in a folder, which keeps running while the app shows
 * another; a folder can have several.
 */
export type Agent = {
  /** pi's session id, which names its saved conversation. */
  id: string;
  cwd: string;
  /** Where it works: its own worktree, or `cwd` when the folder isn't in git. */
  workdir: string;
  /** Its first user message, which names it in the sidebar. */
  title: string;
  /** Settles once its worktree has the folder's ignored files (dependencies, builds). */
  ready: Promise<void>;
  /** Null while it opens. */
  session: Session | null;
  opening: Promise<Session>;
  /** Between agent_start and agent_settled. */
  running: boolean;
  /** The user picked its model, so Model Router is off for it. */
  pickedModel?: boolean;
  /** The new message the router is reading; Stop drops it and hands it back. */
  routing?: {
    text: string;
    images?: ImageContent[];
    /** As the app shows it, for a view opened while it's routed. */
    message: UserMessage;
    controller: AbortController;
  };
  /** Its last run ended in an error. */
  failed?: boolean;
  /** Unsubscribe from the session's events. */
  unsubscribe: () => void;
  /** Adapter status per server name, from the session's latest snapshot. */
  mcpStatus: Map<string, string>;
  /** mcp.json or trust changed while pi was running; reload once the run ends. */
  reloadWhenSettled: boolean;
  /** Tool calls waiting for the user, by tool call id. */
  approvals: Map<string, ApprovalAsk>;
  /**
   * Queued messages' images by their text, which is all pi's queue lists;
   * oldest first, as pi delivers and removes the first match.
   */
  queuedImages: Map<string, ImageContent[][]>;
  /** Subagents it started, by id, as its tool calls report them. */
  subagents: Map<string, SubagentStatus>;
  /** Running tool calls' latest progress, by tool call id, until pi saves their results. */
  toolRuns: Map<string, SessionEvent>;
};

type Pending = { resolve(value: string): void; reject(error: Error): void };

/** Shared mutable state for all host functions. */
export type HostContext = {
  runtime: Runtime;
  send: (m: HostMessage) => void;
  openSession: OpenSession;
  sessions: SessionStore;
  workspaces: Pick<Workspaces, "open" | "close">;
  /** The command center's search over folders' conversations and files. */
  search: ReturnType<typeof createSearch>;
  /** The session that shows what a new conversation would start with. */
  draft: (pick: DraftPick) => Promise<Session>;
  local: LocalLogins;
  mcpStore: McpStore;
  openMcpSession: OpenMcpSession;
  /** The MCP session, once asked for. */
  mcpSession: Promise<Session> | null;
  /** Adapter status per server name, from the MCP session's latest snapshot. */
  mcpStatus: Map<string, string>;
  catalog: McpCatalogSource;
  trust: TrustStore;
  skills: SkillStore;
  tasks: TaskStore;
  /** Tasks being started right now, by id. */
  starting: Set<string>;
  /** Active sign-in's abort controller, or null. */
  activeLogin: AbortController | null;
  /** Every conversation open in this window, by id. */
  agents: Map<string, Agent>;
  /** The conversation the app shows. */
  shown: string | null;
  /** Each folder's last shown conversation, shown again when the folder is. */
  lastShown: Map<string, string>;
  /** URL servers being connected once after setup. */
  checking: Set<string>;
  /** Pending auth prompts, keyed by id. */
  prompts: Map<number, Pending>;
  /** Counter for the next auth prompt id. */
  nextPromptId: number;
  /**
   * Claude Code's last known sign-in and when it was checked; the model list
   * uses it rather than wait on `claude auth status` each time.
   */
  claudeLogin: { loggedIn: boolean; at: number } | null;
  /** Told whether any folder's agent is working (running, not waiting on the user). */
  keepAwake: (working: boolean) => Promise<void>;
};

/** Returns the conversation the app shows, if any. */
export function shown(ctx: HostContext): Agent | undefined {
  return ctx.shown === null ? undefined : ctx.agents.get(ctx.shown);
}

/** Whether the app shows this conversation. */
export function isShown(ctx: HostContext, agent: Agent): boolean {
  return shown(ctx) === agent;
}

/** The folder's conversation to show: the last one shown, else another one open; a folder may have none. */
export function reopened(ctx: HostContext, cwd: string): string | undefined {
  const last = ctx.lastShown.get(cwd);
  if (last && ctx.agents.has(last)) return last;
  return [...ctx.agents.values()].find((a) => a.cwd === cwd)?.id;
}

/** The open conversation `id` names, else the one the app shows. */
export function target(ctx: HostContext, id?: string): Agent | undefined {
  return id === undefined ? shown(ctx) : ctx.agents.get(id);
}

/** Returns that conversation's session once it's open; throws if it isn't. */
export async function current(ctx: HostContext, id?: string): Promise<Session> {
  const agent = target(ctx, id);
  if (!agent) {
    throw new Error(
      id ? "That conversation isn't open." : "No folder is open.",
    );
  }
  return agent.opening;
}
