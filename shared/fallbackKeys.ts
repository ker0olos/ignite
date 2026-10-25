// claude-bridge leads a plan limit with "Claude quota exceeded"; the rest is Claude Code's own wording.
const LIMIT_HIT = /quota exceeded|usage limit|out of (extra )?usage/i;

/** Whether a reply failed because the Claude subscription ran out, which moves the run onto a fallback key. */
export function limitHit(message: {
  stopReason?: string;
  errorMessage?: string;
}): boolean {
  return (
    message.stopReason === "error" && LIMIT_HIT.test(message.errorMessage ?? "")
  );
}

/** A fallback Anthropic API key as the app sees it: never the key itself, only its last characters. */
export type FallbackKeyInfo = { id: string; hint: string };

/** The Claude card's fallback keys; each resolves to the keys, in the order they're tried. */
export type FallbackKeyRequest =
  | { id: number; type: "fallback_keys" }
  | { id: number; type: "fallback_key_add"; apiKey: string }
  | { id: number; type: "fallback_key_remove"; key: string }
  | { id: number; type: "fallback_key_move"; key: string; by: -1 | 1 };

export type FallbackKeyResponses = {
  fallback_keys: FallbackKeyInfo[];
  fallback_key_add: FallbackKeyInfo[];
  fallback_key_remove: FallbackKeyInfo[];
  fallback_key_move: FallbackKeyInfo[];
};
