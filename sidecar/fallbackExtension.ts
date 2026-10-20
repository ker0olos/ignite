/**
 * Moves a conversation whose Claude subscription ran out onto the user's
 * fallback keys (in order, the next one when one fails) and continues the run;
 * back on the subscription with the first message after it resets.
 */
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  keyFailed,
  keysAfter,
  limitedUntil,
  limitHit,
  limitUntil,
  resetFrom,
  resetIn,
  SUBSCRIPTION,
} from "./fallback.ts";
import { loadKeys, type FallbackKey } from "./fallbackKeys.ts";

/** pi event bus channel asking the host to set (or, with `key: null`, drop) a key in this session's model runtime. */
export const FALLBACK_KEY_EVENT = "app/fallback-key";

/** A key for the session's runtime; `done` once it's set. */
export type FallbackKeyAsk = {
  provider: string;
  key: string | null;
  done(error?: unknown): void;
};

type KeyedRuntime = {
  setRuntimeApiKey(provider: string, key: string): Promise<void>;
  removeRuntimeApiKey(provider: string): Promise<void>;
};

/** Sets the keys a session's fallback extension asks for (over its `events`) in its `runtime`; `copyTo` gives them to a subagent's. */
export function answerKeys(
  events: { on(channel: string, handler: (data: unknown) => void): unknown },
  runtime: KeyedRuntime,
) {
  const keys = new Map<string, string>();
  events.on(FALLBACK_KEY_EVENT, (data) => {
    const { provider, key, done } = data as FallbackKeyAsk;
    keys.delete(provider);
    const set =
      key === null
        ? runtime.removeRuntimeApiKey(provider)
        : runtime
            .setRuntimeApiKey(provider, key)
            .then(() => void keys.set(provider, key));
    set.then(() => done(), done);
  });
  return {
    copyTo: async (other: KeyedRuntime) => {
      for (const [provider, key] of keys)
        await other.setRuntimeApiKey(provider, key);
    },
  };
}

const ENTRY = "ignite.fallback";
// The keys stand in for the subscription: the same model ids, on the API.
const KEY_PROVIDER = "anthropic";

/** Where the conversation came from, and the key it runs on; empty on the subscription. */
type State = {
  from?: { provider: string; id: string };
  keyId?: string;
  until?: number;
};

function savedState(ctx: ExtensionContext): State {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i]!;
    if (entry.type === "custom" && entry.customType === ENTRY)
      return (entry.data as State) ?? {};
  }
  return {};
}

/** Notes the error's reset unless the rate-limit header already gave one. */
function noteLimit(errorMessage = "") {
  if (limitedUntil() <= Date.now()) limitUntil(resetIn(errorMessage));
}

/** The run's failed reply, if its last entry is one. */
function failedReply(ctx: ExtensionContext) {
  const last = ctx.sessionManager.getBranch().at(-1);
  if (last?.type !== "message" || last.message.role !== "assistant") return;
  return last.message.stopReason === "error"
    ? { id: last.id, message: last.message }
    : undefined;
}

/** Whether this failure moves the conversation on: the subscription ran out, or the key in use failed. */
function movesOn(ctx: ExtensionContext, state: State, failed: Failed) {
  if (ctx.model?.provider !== SUBSCRIPTION)
    return !!state.keyId && keyFailed(failed);
  if (!limitHit(failed)) return false;
  noteLimit(failed.errorMessage);
  return true;
}

type Failed = { stopReason?: string; errorMessage?: string };

/** The fallback extension: switches keys as the subscription runs out and resets. */
export default function fallback(pi: ExtensionAPI) {
  let state: State = {};

  const ask = (provider: string, key: string | null) =>
    new Promise<void>((resolve, reject) =>
      pi.events.emit(FALLBACK_KEY_EVENT, {
        provider,
        key,
        done: (error) => (error ? reject(error) : resolve()),
      } satisfies FallbackKeyAsk),
    );
  const applyKey = (key: FallbackKey) => ask(KEY_PROVIDER, key.key);
  // Back on the subscription, the key stays out of the model menu and background calls.
  const dropKey = () => void ask(KEY_PROVIDER, null).catch(() => {});

  // A reopened conversation's runtime has no runtime key yet.
  pi.on("session_start", async (_event, ctx) => {
    state = savedState(ctx);
    if (state.until) limitUntil(state.until);
    if (!state.keyId) return;
    const key = (await loadKeys()).find((k) => k.id === state.keyId);
    if (key) await applyKey(key).catch(() => {});
  });

  pi.on("after_provider_response", (event) => {
    const until = resetFrom(event.headers);
    if (until) limitUntil(until);
  });

  /** Switches to the first of the next keys that works; false when none does. */
  const switchKey = async (
    ctx: ExtensionContext,
    from: { provider: string; id: string },
  ) => {
    const model = ctx.modelRegistry.find(KEY_PROVIDER, from.id);
    if (!model) return false;
    for (const key of keysAfter(await loadKeys(), state.keyId)) {
      const ok = await applyKey(key)
        .then(() => pi.setModel(model))
        .catch(() => false);
      if (!ok) continue;
      state = { from, keyId: key.id, until: limitedUntil() };
      return true;
    }
    return false;
  };

  pi.on("agent_before_settle", async (event, ctx) => {
    const failed = event.outcome === "error" ? failedReply(ctx) : undefined;
    if (!failed || !ctx.model || !movesOn(ctx, state, failed.message)) return;
    const from = state.from ?? {
      provider: ctx.model.provider,
      id: ctx.model.id,
    };
    if (!(await switchKey(ctx, from))) return;
    return {
      continue: true,
      entries: [
        { type: "context_edit", targetId: failed.id, replacement: null },
        { type: "custom", customType: ENTRY, data: state },
      ],
    };
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!state.from || Date.now() < limitedUntil()) return;
    const model = ctx.modelRegistry.find(state.from.provider, state.from.id);
    if (!model || !(await pi.setModel(model))) return;
    if (state.keyId) dropKey();
    state = {};
    pi.appendEntry(ENTRY, state);
  });
}
