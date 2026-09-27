import {
  PROVIDERS,
  apiKeyProblem,
  type AuthEventData,
  type AuthMethod,
  type AuthPromptData,
  type HostMessage,
  type HostRequest,
  type McpCatalog,
  type McpServer,
  type McpServerStatus,
  type ModelInfo,
  type OpenedSession,
  type ProviderId,
  type ProviderStatus,
  type SessionState,
  type ThinkingLevel,
} from "../shared/hostProtocol.ts";
import type {
  AgentMessage,
  ImageContent,
  SessionEvent,
} from "../shared/agentTypes.ts";
import type { ClaudeCode } from "./claudeCode.ts";
import {
  MCP_SIGN_IN_COMMAND,
  MCP_SIGN_OUT_COMMAND,
  MCP_COPY_SIGN_IN_COMMAND,
  type McpEntry,
  type McpStore,
} from "./mcpConfig.ts";
import { needsSignIn, type ImportSource, type Preset } from "./mcpCatalog.ts";

/** What the MCP settings offer to add in one click. */
export type McpCatalogSource = {
  presets: readonly Preset[];
  /** Other apps' servers, including the open folder's when `cwd` is set. */
  findImports(cwd: string | undefined): Promise<ImportSource[]>;
};

// Server names end up in tool names (mcp__<server>), so keep them simple.
const toServerName = (name: string) => name.replace(/[^A-Za-z0-9_-]+/g, "-");
const target = (e: McpEntry) =>
  typeof e.url === "string" ? e.url : [e.command, ...(e.args ?? [])].join(" ");

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
    options: { streamingBehavior?: "steer" | "followUp" },
  ): Promise<void>;
  abort(): Promise<void>;
  /** Reloads extensions, which re-reads mcp.json. */
  reload(): Promise<void>;
  readonly extensionRunner: {
    emit(event: { type: "session_shutdown"; reason: "quit" }): Promise<unknown>;
    getCommand(name: string): unknown;
  };
  dispose(): void;
};

/** pi-mcp-adapter's status snapshot (its MCP_STATUS_EVENT), as far as it's read. */
export type McpStatusSnapshot = {
  servers: readonly { name: string; status: string }[];
};

/** Opens a folder's session; the adapter's status snapshots go to `onMcpStatus`. */
export type OpenSession = (
  cwd: string,
  onMcpStatus: (snapshot: McpStatusSnapshot) => void,
) => Promise<Session>;

const MCP_STATUSES: Record<string, McpServerStatus> = {
  connected: "connected",
  cached: "idle",
  "not-connected": "idle",
  failed: "failed",
  "needs-auth": "needs-auth",
  disabled: "disabled",
};

/**
 * pi's documented wire form of a session event (docs/json.md): message_update
 * drops the cumulative message and partial snapshots, so each update carries
 * only its delta.
 */
export function toWireEvent(event: SessionEvent): SessionEvent {
  if (event.type !== "message_update") return event;
  const update: Record<string, unknown> = { ...event.assistantMessageEvent };
  const wire: Record<string, unknown> = {
    ...event,
    assistantMessageEvent: update,
  };
  delete wire.message;
  delete update.partial;
  return wire as SessionEvent;
}

type Pending = { resolve(value: string): void; reject(error: Error): void };

/** Turns pi's errors into sentences for the connect screen. */
export function describeError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "EADDRINUSE") {
    return "Another app is using the sign-in port. Close other sign-ins (pi, Claude Code) and try again.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Handles the app's requests against pi's ModelRuntime. One sign-in runs at a
 * time; its prompts are forwarded to the app and answered by id.
 */
export function createHost(
  runtime: Runtime,
  send: (m: HostMessage) => void,
  openSession: OpenSession,
  local: LocalLogins,
  mcpStore: McpStore,
  catalog: McpCatalogSource,
) {
  const { claudeCode } = local;
  let activeLogin: AbortController | null = null;
  let session: Session | null = null;
  let unsubscribe = () => {};
  // Adapter status per server name, from the open session's latest snapshot.
  let mcpStatus = new Map<string, string>();
  // Removed servers whose saved sign-in still has to be deleted.
  const pendingSignOuts = new Set<string>();
  // URL servers being connected once after setup.
  const checking = new Set<string>();
  // mcp.json changed while pi was running; reload once the run ends.
  let reloadWhenSettled = false;
  // Counts opened folders, so a replaced session's status is ignored.
  let opens = 0;
  const prompts = new Map<number, Pending>();
  let nextPromptId = 1;

  async function status(id: ProviderId): Promise<ProviderStatus> {
    if (id === "claude-code") {
      const { installed, loggedIn } = await claudeCode.status();
      return loggedIn
        ? { id, connected: true, method: "oauth", installed }
        : { id, connected: false, installed };
    }
    const auth = await runtime.checkAuth(id);
    if (!auth) return { id, connected: false };
    if (id === "openai-codex" && (await local.usesCodexLogin())) {
      return { id, connected: true, method: auth.type, viaCodex: true };
    }
    return { id, connected: true, method: auth.type };
  }

  function interaction(signal: AbortSignal, apiKey?: string): Interaction {
    return {
      signal,
      notify: (event) => send({ type: "auth_event", event }),
      prompt: ({ signal: promptSignal, ...prompt }) => {
        // The key came with the request; pi's own prompt for it is answered here.
        if (prompt.type === "secret" && apiKey !== undefined) {
          return Promise.resolve(apiKey);
        }
        // Codex asks browser vs device code; always use the browser, like Claude.
        if (
          prompt.type === "select" &&
          prompt.options.some((o) => o.id === "browser")
        ) {
          return Promise.resolve("browser");
        }
        const promptId = nextPromptId++;
        send({ type: "auth_prompt", promptId, prompt });
        return new Promise<string>((resolve, reject) => {
          const settle = () => prompts.delete(promptId);
          prompts.set(promptId, {
            resolve: (value) => (settle(), resolve(value)),
            reject: (error) => (settle(), reject(error)),
          });
          // pi closes a prompt it no longer needs; so does cancelling the sign-in.
          const close = () => {
            if (!prompts.has(promptId)) return;
            settle();
            send({ type: "auth_prompt_closed", promptId });
            reject(new Error("Prompt closed"));
          };
          promptSignal?.addEventListener("abort", close, { once: true });
          signal.addEventListener("abort", close, { once: true });
        });
      },
    };
  }

  async function login(
    provider: ProviderId,
    method: AuthMethod,
    apiKey?: string,
  ): Promise<ProviderStatus> {
    if (activeLogin) throw new Error("Another sign-in is already in progress.");
    if (method === "api_key") {
      const problem = apiKeyProblem(apiKey ?? "");
      if (problem) throw new Error(problem);
    }
    const controller = new AbortController();
    activeLogin = controller;
    try {
      if (provider === "claude-code") {
        await claudeCode.login(controller.signal, (url) =>
          send({ type: "auth_event", event: { type: "auth_url", url } }),
        );
      } else {
        await runtime.login(
          provider,
          method,
          interaction(controller.signal, apiKey?.trim()),
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Sign-in cancelled.", { cause: error });
      }
      throw error;
    } finally {
      activeLogin = null;
    }
    return status(provider);
  }

  const info = ({ provider, id, name }: ModelInfo): ModelInfo => ({
    provider,
    id,
    name,
  });

  function current(): Session {
    if (!session) throw new Error("No folder is open.");
    return session;
  }

  // Everything comes from pi: the connected providers' models, and the levels
  // the session's model supports (pi clamps the level itself).
  async function sessionState(): Promise<SessionState> {
    const s = current();
    const [models, claude] = await Promise.all([
      runtime.getAvailable(),
      claudeCode.status(),
    ]);
    // The bridge lists its models whether or not Claude Code is signed in.
    const usable = models.filter(
      (m) => m.provider !== "claude-bridge" || claude.loggedIn,
    );
    return {
      models: usable.map(info),
      model: s.model && info(s.model),
      thinkingLevel: s.thinkingLevel,
      thinkingLevels: s.getAvailableThinkingLevels(),
    };
  }

  async function setModel(provider: string, modelId: string) {
    const s = current();
    const model = (await runtime.getAvailable()).find(
      (m) => m.provider === provider && m.id === modelId,
    );
    if (!model) throw new Error(`${modelId} isn't available.`);
    // Persisted so the next session starts with the same choice.
    await s.setModel(model, { persist: true });
    return sessionState();
  }

  async function open(cwd: string): Promise<OpenedSession> {
    const opened = ++opens;
    const previous = session;
    unsubscribe();
    session = null;
    reloadWhenSettled = false;
    mcpStatus = new Map();
    checking.clear();
    if (previous) {
      // dispose() alone leaves extensions running (MCP server processes).
      await previous.extensionRunner.emit({
        type: "session_shutdown",
        reason: "quit",
      });
      previous.dispose();
    }
    // Status can arrive while the session is still opening; it's kept, and
    // pushed with the servers once the session is open.
    const s = await openSession(cwd, (snapshot) => {
      if (opened !== opens) return;
      mcpStatus = new Map(snapshot.servers.map((m) => [m.name, m.status]));
      // While the session is still opening, open() pushes once it's done.
      const push = !!session;
      void rememberSignIns(snapshot).then(() => {
        if (push) void pushMcpServers();
      });
    });
    session = s;
    // ponytail: kept in memory; a sidecar restart before a folder opens drops them.
    for (const name of [...pendingSignOuts]) {
      pendingSignOuts.delete(name);
      await signOut(name);
    }
    unsubscribe = s.subscribe((event) => {
      send({ type: "session_event", event: toWireEvent(event) });
      if (event.type === "agent_settled" && reloadWhenSettled) {
        reloadWhenSettled = false;
        s.reload().catch((error: unknown) =>
          send({ type: "session_error", error: describeError(error) }),
        );
      }
    });
    // Servers now have a status, even before the adapter reports any.
    void pushMcpServers();
    return {
      ...(await sessionState()),
      messages: s.messages,
      running: s.isStreaming,
    };
  }

  // pi's prompt() resolves when the whole run ends; the app follows the run
  // through events, so only a failure is reported here.
  function prompt(text: string, images?: ImageContent[]) {
    const s = current();
    // A message sent mid-run steers the agent rather than waiting for the end.
    const options = {
      ...(s.isStreaming && { streamingBehavior: "steer" as const }),
      ...(images?.length ? { images } : {}),
    };
    s.prompt(text, options).catch((error: unknown) =>
      send({ type: "session_error", error: describeError(error) }),
    );
  }

  // What the adapter learns about sign-in outlives it: a server stays "needs
  // sign-in" after a restart until it connects, without connecting to find out.
  async function rememberSignIns(snapshot: McpStatusSnapshot) {
    for (const { name, status } of snapshot.servers) {
      if (status === "needs-auth") await mcpStore.setNeedsSignIn(name, true);
      if (status === "connected") await mcpStore.setNeedsSignIn(name, false);
    }
  }

  async function mcpServers(): Promise<McpServer[]> {
    const saved = await mcpStore.list();
    if (!session) return saved;
    const signIns = await mcpStore.needsSignIn();
    const known = (name: string) => {
      const status = MCP_STATUSES[mcpStatus.get(name) ?? ""] ?? "idle";
      return status === "idle" && signIns.includes(name)
        ? "needs-auth"
        : status;
    };
    // ponytail: a failed server shows no reason; the adapter only logs it to
    // stderr. Show it once the status snapshot carries one.
    return saved.map((server) => ({
      ...server,
      status: !server.enabled
        ? "disabled"
        : checking.has(server.name)
          ? "checking"
          : known(server.name),
    }));
  }

  async function pushMcpServers() {
    try {
      send({ type: "mcp_servers", servers: await mcpServers() });
    } catch {
      // mcp.json is unreadable; the next request reports why.
    }
  }

  // The session's adapter only reads mcp.json on (re)load.
  /**
   * Saves a change and applies it. Servers still connect lazily, but URL
   * servers in `check` connect once now, so one that needs sign-in says so
   * while it's being set up rather than when the agent first needs it.
   */
  async function changeMcp(edit: () => Promise<void>, check: string[] = []) {
    await edit();
    if (session?.isStreaming) {
      reloadWhenSettled = true;
    } else if (session) {
      await session.reload();
      await checkUrlServers(check);
    }
    return mcpServers();
  }

  /** Marks the URL servers among `names` as checking, then checks them in the background. */
  async function checkUrlServers(names: string[]) {
    const s = session;
    if (!s?.extensionRunner.getCommand("mcp")) return;
    const urls = (await mcpStore.list())
      .filter((m) => names.includes(m.name) && m.enabled)
      .filter((m) => m.config.type === "http")
      .map((m) => m.name);
    urls.forEach((name) => checking.add(name));
    void (async () => {
      for (const name of urls) {
        // The result arrives as a status snapshot; a failure is shown there.
        await s.prompt(`/mcp reconnect ${name}`, {}).catch(() => {});
        checking.delete(name);
        await pushMcpServers();
      }
    })();
  }

  async function mcpCatalog(cwd?: string): Promise<McpCatalog> {
    const taken = new Set((await mcpStore.list()).map((m) => m.name));
    const sources = await catalog.findImports(cwd);
    return {
      presets: catalog.presets.map((p) => ({
        id: p.id,
        name: p.name,
        summary: p.summary,
        signIn: needsSignIn(p.entry),
        added: taken.has(p.id),
      })),
      sources: sources.map(({ id, app, scope, servers }) => ({
        id,
        app,
        scope,
        servers: Object.entries(servers).map(([name, entry]) => ({
          name,
          target: target(entry),
          added: taken.has(toServerName(name)),
        })),
      })),
    };
  }

  function addPreset(id: string) {
    const preset = catalog.presets.find((p) => p.id === id);
    if (!preset) throw new Error(`There is no preset named ${id}.`);
    return changeMcp(
      () => mcpStore.add({ [preset.id]: preset.entry }),
      [preset.id],
    );
  }

  async function importServers(
    sourceId: string,
    names: string[],
    cwd?: string,
  ) {
    const source = (await catalog.findImports(cwd)).find(
      (s) => s.id === sourceId,
    );
    if (!source) throw new Error("Those servers are no longer there.");
    const entries = Object.entries(source.servers)
      .filter(([name]) => names.includes(name))
      .map(([name, entry]) => [toServerName(name), entry] as const);
    return changeMcp(
      async () => {
        await mcpStore.add(Object.fromEntries(entries));
        if (source.app === "Claude Code") {
          for (const [name, entry] of entries) {
            if ("url" in entry) await copySignIn(name);
          }
        }
      },
      entries.map(([name]) => name),
    );
  }

  // A refused keychain or no saved sign-in leaves the server to sign in as usual.
  async function copySignIn(name: string) {
    const s = session;
    if (!s?.extensionRunner.getCommand(MCP_COPY_SIGN_IN_COMMAND)) return;
    await s.prompt(`/${MCP_COPY_SIGN_IN_COMMAND} ${name}`, {}).catch(() => {});
  }

  /**
   * Deletes a server's saved sign-in, so removing and re-adding it asks again.
   * Without a session to run it in, it runs when the next folder opens.
   */
  async function signOut(name: string) {
    const s = session;
    if (s?.extensionRunner.getCommand(MCP_SIGN_OUT_COMMAND)) {
      try {
        await s.prompt(`/${MCP_SIGN_OUT_COMMAND} ${name}`, {});
        return;
      } catch {
        // Retried when the next folder opens.
      }
    }
    pendingSignOuts.add(name);
  }

  async function signIn(name: string) {
    const s = await usableServer(name);
    if (!s.extensionRunner.getCommand(MCP_SIGN_IN_COMMAND)) {
      throw new Error("MCP sign-in isn't available in this session.");
    }
    // Opens the sign-in page through the app and waits for the browser's
    // callback; a failure comes back as an extension_error.
    await s.prompt(`/${MCP_SIGN_IN_COMMAND} ${name}`, {});
    await s.prompt(`/mcp reconnect ${name}`, {});
    return mcpServers();
  }

  async function usableServer(name: string) {
    const s = current();
    const server = (await mcpStore.list()).find((m) => m.name === name);
    if (!server) throw new Error(`There is no server named ${name}.`);
    if (!server.enabled) throw new Error(`Turn ${name} on first.`);
    // Without the adapter, pi would send the command to the model as text.
    if (!s.extensionRunner.getCommand("mcp")) {
      throw new Error("MCP isn't running in this session. Check mcp.json.");
    }
    return s;
  }

  async function run(request: Extract<HostRequest, { id: number }>) {
    switch (request.type) {
      case "status":
        return Promise.all(PROVIDERS.map(status));
      case "login":
        return login(request.provider, request.method, request.apiKey);
      case "cancel_login":
        activeLogin?.abort();
        return undefined;
      case "logout":
        // Signing out would sign the user out of Claude Code itself.
        if (request.provider === "claude-code") {
          throw new Error("Sign out of Claude Code in Claude Code.");
        }
        await runtime.logout(request.provider);
        return status(request.provider);
      case "open_session":
        return open(request.cwd);
      case "session_state":
        return sessionState();
      case "set_model":
        return setModel(request.provider, request.modelId);
      case "set_thinking_level":
        current().setThinkingLevel(request.level, { persist: true });
        return sessionState();
      case "prompt":
        prompt(request.text, request.images);
        return undefined;
      case "abort":
        await current().abort();
        return undefined;
      case "mcp_list":
        return mcpServers();
      case "mcp_save":
        return changeMcp(
          () =>
            mcpStore.save(request.name, request.config, request.previousName),
          [request.name],
        );
      case "mcp_remove":
        return changeMcp(async () => {
          await signOut(request.name);
          await mcpStore.remove(request.name);
        });
      case "mcp_set_enabled":
        return changeMcp(() =>
          mcpStore.setEnabled(request.name, request.enabled),
        );
      case "mcp_sign_in":
        return signIn(request.name);
      case "mcp_catalog":
        return mcpCatalog(request.cwd);
      case "mcp_add_preset":
        return addPreset(request.preset);
      case "mcp_import":
        return importServers(request.source, request.names, request.cwd);
    }
  }

  /** Handles one request from the app; never throws. */
  async function handle(request: HostRequest): Promise<void> {
    if (request.type === "prompt_answer") {
      prompts.get(request.promptId)?.resolve(request.value);
      return;
    }
    if (request.type === "prompt_cancel") {
      prompts.get(request.promptId)?.reject(new Error("Cancelled"));
      return;
    }
    try {
      const data = await run(request);
      send({ type: "response", id: request.id, ok: true, data });
    } catch (error) {
      send({
        type: "response",
        id: request.id,
        ok: false,
        error: describeError(error),
      });
    }
  }

  return { handle };
}
