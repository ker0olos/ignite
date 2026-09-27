import {
  apiKeyProblem,
  type AuthPromptData,
  type AuthEventData,
  type AuthMethod,
  type ProviderStatus,
  type ProviderId,
} from "../shared/hostProtocol.ts";
import type { HostContext } from "./hostTypes.ts";

/** Checks authentication status for a provider. */
export async function status(
  ctx: HostContext,
  id: ProviderId,
): Promise<ProviderStatus> {
  if (id === "claude-code") {
    const { installed, loggedIn } = await ctx.local.claudeCode.status();
    return loggedIn
      ? { id, connected: true, method: "oauth", installed }
      : { id, connected: false, installed };
  }
  const auth = await ctx.runtime.checkAuth(id);
  if (!auth) return { id, connected: false };
  if (id === "openai-codex" && (await ctx.local.usesCodexLogin())) {
    return { id, connected: true, method: auth.type, viaCodex: true };
  }
  return { id, connected: true, method: auth.type };
}

function interaction(ctx: HostContext, signal: AbortSignal, apiKey?: string) {
  return {
    signal,
    notify: (event: AuthEventData) => ctx.send({ type: "auth_event", event }),
    prompt: ({
      signal: promptSignal,
      ...prompt
    }: AuthPromptData & { signal?: AbortSignal }) => {
      // The key came with the request; pi's own prompt for it is answered here.
      if (prompt.type === "secret" && apiKey !== undefined) {
        return Promise.resolve(apiKey);
      }
      // Codex asks browser vs device code; always use the browser, like Claude.
      if (
        prompt.type === "select" &&
        prompt.options.some((o: { id: string }) => o.id === "browser")
      ) {
        return Promise.resolve("browser");
      }
      const promptId = ctx.nextPromptId++;
      ctx.send({ type: "auth_prompt", promptId, prompt });
      return new Promise<string>((resolve, reject) => {
        const settle = () => ctx.prompts.delete(promptId);
        ctx.prompts.set(promptId, {
          resolve: (value) => (settle(), resolve(value)),
          reject: (error) => (settle(), reject(error)),
        });
        // pi closes a prompt it no longer needs; so does cancelling the sign-in.
        const close = () => {
          if (!ctx.prompts.has(promptId)) return;
          settle();
          ctx.send({ type: "auth_prompt_closed", promptId });
          reject(new Error("Prompt closed"));
        };
        promptSignal?.addEventListener("abort", close, { once: true });
        signal.addEventListener("abort", close, { once: true });
      });
    },
  };
}

/** Signs into a provider and returns its updated status. */
export async function login(
  ctx: HostContext,
  provider: ProviderId,
  method: AuthMethod,
  apiKey?: string,
): Promise<ProviderStatus> {
  if (ctx.activeLogin)
    throw new Error("Another sign-in is already in progress.");
  if (method === "api_key") {
    const problem = apiKeyProblem(apiKey ?? "");
    if (problem) throw new Error(problem);
  }
  const controller = new AbortController();
  ctx.activeLogin = controller;
  try {
    if (provider === "claude-code") {
      await ctx.local.claudeCode.login(controller.signal, (url) =>
        ctx.send({ type: "auth_event", event: { type: "auth_url", url } }),
      );
    } else {
      await ctx.runtime.login(
        provider,
        method,
        interaction(ctx, controller.signal, apiKey?.trim()),
      );
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Sign-in cancelled.", { cause: error });
    }
    throw error;
  } finally {
    ctx.activeLogin = null;
  }
  return status(ctx, provider);
}
