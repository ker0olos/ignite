import {
  PROVIDERS,
  apiKeyProblem,
  type AuthEventData,
  type AuthMethod,
  type AuthPromptData,
  type HostMessage,
  type HostRequest,
  type ProviderId,
  type ProviderStatus,
} from "../shared/hostProtocol.ts";

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
export function createHost(runtime: Runtime, send: (m: HostMessage) => void) {
  let activeLogin: AbortController | null = null;
  const prompts = new Map<number, Pending>();
  let nextPromptId = 1;

  async function status(id: ProviderId): Promise<ProviderStatus> {
    const auth = await runtime.checkAuth(id);
    return auth
      ? { id, connected: true, method: auth.type }
      : { id, connected: false };
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
      await runtime.login(
        provider,
        method,
        interaction(controller.signal, apiKey?.trim()),
      );
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
        await runtime.logout(request.provider);
        return status(request.provider);
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
