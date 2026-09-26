/**
 * Wire protocol between the app (web view) and the pi host sidecar
 * (sidecar/main.ts): one JSON object per line, in both directions.
 * Auth prompt and event shapes mirror pi-ai's AuthPrompt / AuthEvent, minus
 * the AbortSignals that can't cross a process boundary.
 */
import type { AgentMessage, SessionEvent } from "./agentTypes.ts";

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

/** What opening a folder's session returns: its settings and its history. */
export type OpenedSession = SessionState & {
  /** The conversation so far, when an earlier session is continued. */
  messages: AgentMessage[];
  /** Whether pi is still working on it. */
  running: boolean;
};

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
  /** Starts the agent session for a folder, replacing any previous one. */
  | { id: number; type: "open_session"; cwd: string }
  | { id: number; type: "session_state" }
  | { id: number; type: "set_model"; provider: string; modelId: string }
  | { id: number; type: "set_thinking_level"; level: ThinkingLevel }
  /** Resolves once pi has accepted the message; the run streams as events. */
  | { id: number; type: "prompt"; text: string }
  | { id: number; type: "abort" }
  | { type: "prompt_answer"; promptId: number; value: string }
  | { type: "prompt_cancel"; promptId: number };

/** What each request resolves to. */
export type HostResponses = {
  status: ProviderStatus[];
  login: ProviderStatus;
  cancel_login: undefined;
  logout: ProviderStatus;
  open_session: OpenedSession;
  session_state: SessionState;
  set_model: SessionState;
  set_thinking_level: SessionState;
  prompt: undefined;
  abort: undefined;
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
  | { type: "session_event"; event: SessionEvent }
  /** A run pi accepted but couldn't carry out (e.g. no model or credentials). */
  | { type: "session_error"; error: string };

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
