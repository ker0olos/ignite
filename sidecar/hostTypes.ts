import type {
  ModelInfo,
  ThinkingLevel,
  AuthEventData,
  AuthMethod,
  AuthPromptData,
  HostMessage,
} from "../shared/hostProtocol.ts";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import type { ApprovalAsk } from "./approvalExtension.ts";
import type { ClaudeCode } from "./claudeCode.ts";
import type { McpStore } from "./mcpConfig.ts";
import type { Preset, ImportSource } from "./mcpCatalog.ts";
import type { TrustStore } from "./trust.ts";

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
  getAvailable(): Promise<readonly ModelInfo[]>;
};

/** The slice of pi's AgentSession the host needs; tests pass a fake. */
export type Session = {
  readonly model: ModelInfo | undefined;
  readonly thinkingLevel: ThinkingLevel;
  getAvailableThinkingLevels(): ThinkingLevel[];
  setModel(model: ModelInfo, options: { persist: boolean }): Promise<void>;
  setThinkingLevel(level: ThinkingLevel, options: { persist: boolean }): void;
  readonly messages: AgentMessage[];
  readonly isStreaming: boolean;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  prompt(
    text: string,
    options: { streamingBehavior?: "steer" | "followUp"; images?: unknown[] },
  ): Promise<void>;
  abort(): Promise<void>;
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
 * Opens a folder's session; the adapter's status snapshots go to
 * `onMcpStatus`, tool calls waiting for the user to `onApproval`.
 */
export type OpenSession = (
  cwd: string,
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
  onApproval: (ask: ApprovalAsk) => void,
  /** Deletes the folder's saved conversations and starts an empty one. */
  fresh: boolean,
) => Promise<Session>;

/** A folder's session, which keeps running while the app shows another folder. */
export type Project = {
  /** Null while it opens. */
  session: Session | null;
  opening: Promise<Session>;
  /** Between agent_start and agent_settled. */
  running: boolean;
  /** Unsubscribe from the session's events. */
  unsubscribe: () => void;
  /** Adapter status per server name, from the session's latest snapshot. */
  mcpStatus: Map<string, string>;
  /** mcp.json or trust changed while pi was running; reload once the run ends. */
  reloadWhenSettled: boolean;
  /** Tool calls waiting for the user, by tool call id. */
  approvals: Map<string, ApprovalAsk>;
};

type Pending = { resolve(value: string): void; reject(error: Error): void };

/** Shared mutable state for all host functions. */
export type HostContext = {
  runtime: Runtime;
  send: (m: HostMessage) => void;
  openSession: OpenSession;
  local: LocalLogins;
  mcpStore: McpStore;
  catalog: McpCatalogSource;
  trust: TrustStore;
  /** Active sign-in's abort controller, or null. */
  activeLogin: AbortController | null;
  /** Every folder opened in this window, by path. */
  projects: Map<string, Project>;
  /** The folder the app shows. */
  cwd: string | null;
  /** Removed servers whose saved sign-in still has to be deleted. */
  pendingSignOuts: Set<string>;
  /** URL servers being connected once after setup. */
  checking: Set<string>;
  /** Pending auth prompts, keyed by id. */
  prompts: Map<number, Pending>;
  /** Counter for the next auth prompt id. */
  nextPromptId: number;
  /** Told whether any folder's agent is working (running, not waiting on the user). */
  keepAwake: (working: boolean) => Promise<void>;
};

/** Returns the shown folder's project, if it has one. */
export function shown(ctx: HostContext): Project | undefined {
  return ctx.cwd === null ? undefined : ctx.projects.get(ctx.cwd);
}

/** Returns the shown folder's session once it's open; throws if none is. */
export async function current(ctx: HostContext): Promise<Session> {
  const project = shown(ctx);
  if (!project) throw new Error("No folder is open.");
  return project.opening;
}
