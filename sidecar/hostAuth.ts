import type {
  AuthPromptData,
  AuthEventData,
  AuthMethod,
  ProviderStatus,
  ProviderId,
} from "../shared/hostProtocol.ts";
import { apiKeyProblem } from "../shared/validation.ts";
import type { HostContext } from "./hostTypes.ts";

/** Checks Claude Code's install and sign-in, remembering the sign-in. */
export async function claudeCodeStatus(ctx: HostContext) {
  const checked = await ctx.local.claudeCode.status();
  ctx.claudeLogin = { loggedIn: checked.loggedIn, at: Date.now() };
  return checked;
}

const RECHECK_MS = 30_000;

/**
 * Whether Claude Code is signed in: the last answer at once, checked again
 * behind it when it's older than RECHECK_MS (a change shows next time).
 */
export async function claudeLoggedIn(ctx: HostContext): Promise<boolean> {
  const known = ctx.claudeLogin;
  if (!known) return (await claudeCodeStatus(ctx)).loggedIn;
  if (Date.now() - known.at > RECHECK_MS) {
    known.at = Date.now();
    void claudeCodeStatus(ctx).catch(() => {});
  }
  return known.loggedIn;
}

/** Checks authentication status for a provider. */
export async function status(
  ctx: HostContext,
  id: ProviderId,
): Promise<ProviderStatus> {
  if (id === "claude-code") {
    const { installed, loggedIn } = await claudeCodeStatus(ctx);
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

/** Like status, but reports disconnected if the check takes longer than `ms`. */
export async function statusWithin(
  ctx: HostContext,
  id: ProviderId,
  ms = 10_000,
): Promise<ProviderStatus> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<ProviderStatus>((resolve) => {
    timer = setTimeout(() => {
      process.stderr.write(`pi-host: ${id} status timed out after ${ms}ms\n`);
      resolve({ id, connected: false });
    }, ms);
  });
  try {
    return await Promise.race([status(ctx, id), timedOut]);
  } finally {
    clearTimeout(timer);
    process.stderr.write(
      `pi-host: ${id} status took ${Date.now() - started}ms\n`,
    );
  }
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
