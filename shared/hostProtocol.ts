/**
 * Wire protocol between the app (web view) and the pi host sidecar
 * (sidecar/main.ts): one JSON object per line, in both directions.
 * Auth prompt and event shapes mirror pi-ai's AuthPrompt / AuthEvent, minus
 * the AbortSignals that can't cross a process boundary.
 */

export type ProviderId = "anthropic" | "openai-codex" | "openai";
export type AuthMethod = "oauth" | "api_key";

/** Every provider the app can connect, in display order. */
export const PROVIDERS: readonly ProviderId[] = [
  "anthropic",
  "openai-codex",
  "openai",
];

export type ProviderStatus = {
  id: ProviderId;
  connected: boolean;
  /** How it is connected: a subscription sign-in or an API key. */
  method?: AuthMethod;
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
  | { type: "prompt_answer"; promptId: number; value: string }
  | { type: "prompt_cancel"; promptId: number };

/** What each request resolves to. */
export type HostResponses = {
  status: ProviderStatus[];
  login: ProviderStatus;
  cancel_login: undefined;
  logout: ProviderStatus;
};

/** Messages the sidecar sends. */
export type HostMessage =
  | { type: "ready" }
  | { type: "response"; id: number; ok: true; data?: unknown }
  | { type: "response"; id: number; ok: false; error: string }
  | { type: "auth_event"; event: AuthEventData }
  | { type: "auth_prompt"; promptId: number; prompt: AuthPromptData }
  /** The flow no longer needs this prompt (e.g. the browser callback won). */
  | { type: "auth_prompt_closed"; promptId: number };

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
