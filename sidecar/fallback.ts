/**
 * When the Claude subscription runs out: knowing it did, until when, and which
 * fallback key and model a conversation moves to next.
 */
import { APP_NAME } from "../src/lib/app.ts";
import type { FallbackKey } from "./fallbackKeys.ts";

/** The provider that runs Claude on the user's subscription (pi-claude-bridge). */
export const SUBSCRIPTION = "claude-bridge";

const HOUR = 60 * 60 * 1000;

type Failed = { stopReason?: string; errorMessage?: string };

// What a key's own failure reads like (spent, refused, throttled past pi's retries), not a
// transient or request error, which another key wouldn't fix.
const KEY_FAILED =
  /quota|billing|credit|insufficient|rate.?limit|too many requests|\b(401|403|429)\b|unauthori[sz]ed|authentication|api.?key|permission/i;

/** Whether `message` failed because of the key it ran on. */
export function keyFailed(message: Failed): boolean {
  return (
    message.stopReason === "error" &&
    KEY_FAILED.test(message.errorMessage ?? "")
  );
}

/** When a rejected window resets, from claude-bridge's rate-limit headers (Unix seconds); none while overage still serves it. */
export function resetFrom(headers: Record<string, string>): number | undefined {
  const prefix = "anthropic-ratelimit-unified";
  if (headers[`${prefix}-status`] !== "rejected") return;
  const overage = headers[`${prefix}-overage-status`];
  if (overage && overage !== "rejected") return;
  const reset = Number(headers[`${prefix}-reset`]);
  return reset > 0 ? reset * 1000 : undefined;
}

/** When the limit resets, from the error's local "resets 6:30 PM" (next time it reads that), else in an hour. */
export function resetIn(errorMessage: string, now = Date.now()): number {
  const match = /resets (\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?m?/i.exec(
    errorMessage,
  );
  if (!match) return now + HOUR;
  let hours = Number(match[1]) % 12;
  if (!match[3]) hours = Number(match[1]);
  else if (match[3].toLowerCase() === "p") hours += 12;
  const at = new Date(now);
  at.setHours(hours, Number(match[2]), 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

// The subscription is the account's, so every conversation shares one limit; extensions load
// afresh per session, so it's kept on globalThis.
const LIMIT = Symbol.for(`${APP_NAME}.subscriptionLimit`);
const store = globalThis as { [LIMIT]?: number };

/** Notes the subscription is out until `until`. */
export function limitUntil(until: number) {
  store[LIMIT] = Math.max(store[LIMIT] ?? 0, until);
}

/** When the subscription can be used again; 0 when it isn't known to be out. */
export function limitedUntil(): number {
  return store[LIMIT] ?? 0;
}

type Message = {
  role: string;
  stopReason?: string;
  content?: unknown;
  toolCallId?: string;
};

// claude-bridge marks a reply aborted (or failed) after pi saved it, when the run stops while its
// tool call runs; other providers skip such a reply, and its orphaned results fail every request.
/** `messages` with each failed reply whose tool calls all have results back as pi saved it. */
export function answeredAsSaved<M extends Message>(messages: M[]): M[] {
  const answered = new Set(
    messages.flatMap((m) => (m.role === "toolResult" ? [m.toolCallId] : [])),
  );
  return messages.map((m) => {
    const failed = m.stopReason === "aborted" || m.stopReason === "error";
    if (m.role !== "assistant" || !failed || !Array.isArray(m.content))
      return m;
    const calls = (m.content as { type: string; id?: string }[]).filter(
      (b) => b.type === "toolCall",
    );
    return calls.length > 0 && calls.every((c) => answered.has(c.id))
      ? { ...m, stopReason: "toolUse", errorMessage: undefined }
      : m;
  });
}

/** The keys to try after the one in use (`current`), in order; all of them when none is. */
export function keysAfter(
  keys: FallbackKey[],
  current?: string,
): FallbackKey[] {
  const at = keys.findIndex((k) => k.id === current);
  return at < 0 ? keys : keys.slice(at + 1);
}
