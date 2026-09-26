import {
  PROVIDERS,
  apiKeyProblem,
  type AuthEventData,
  type AuthMethod,
  type AuthPromptData,
  type HostMessage,
  type HostRequest,
  type ModelInfo,
  type OpenedSession,
  type ProviderId,
  type ProviderStatus,
  type SessionState,
  type ThinkingLevel,
} from "../shared/hostProtocol.ts";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import type { ClaudeCode } from "./claudeCode.ts";

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
  dispose(): void;
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
  openSession: (cwd: string) => Promise<Session>,
  local: LocalLogins,
) {
  const { claudeCode } = local;
  let activeLogin: AbortController | null = null;
  let session: Session | null = null;
  let unsubscribe = () => {};
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
    unsubscribe();
    session?.dispose();
    session = null;
    const s = await openSession(cwd);
    session = s;
    unsubscribe = s.subscribe((event) =>
      send({ type: "session_event", event: toWireEvent(event) }),
    );
    return {
      ...(await sessionState()),
      messages: s.messages,
      running: s.isStreaming,
    };
  }

  // pi's prompt() resolves when the whole run ends; the app follows the run
  // through events, so only a failure is reported here.
  function prompt(text: string) {
    const s = current();
    // A message sent mid-run steers the agent rather than waiting for the end.
    const options = s.isStreaming
      ? { streamingBehavior: "steer" as const }
      : {};
    s.prompt(text, options).catch((error: unknown) =>
      send({ type: "session_error", error: describeError(error) }),
    );
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
        prompt(request.text);
        return undefined;
      case "abort":
        await current().abort();
        return undefined;
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
