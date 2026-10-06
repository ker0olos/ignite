import type { QueueKind, QueuedMessage } from "../../shared/queue";
import { typedSkill } from "../../shared/skills";

type Key = {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

/**
 * What a key in the composer does: esc stops a run; with nothing typed, ⇧⌘↵
 * sends the first queued message now; ↵ sends (queued mid-run).
 */
export function composerKey(
  e: Key,
  {
    running,
    empty,
    queued,
  }: { running: boolean; empty: boolean; queued: boolean },
): "stop" | "now" | "send" | null {
  if (e.key === "Escape") return running ? "stop" : null;
  if (e.key !== "Enter" || e.isComposing) return null;
  return e.shiftKey ? sendNow(e.metaKey, empty && queued) : "send";
}

// ⇧↵ alone is a new line.
const sendNow = (meta: boolean, anyQueued: boolean) =>
  meta && anyQueued ? "now" : null;

/** The composer's text with taken-back messages above what's being typed. */
export function takenText(taken: QueuedMessage[], typed: string) {
  return [...taken.map((m) => typedSkill(m.text)), typed]
    .filter(Boolean)
    .join("\n\n");
}

/** A message sent mid-run that pi hasn't delivered yet. */
export type Queued = { kind: QueueKind; text: string };

/** Sets `t`'s queue to what pi lists, steering first (its delivery order). */
export function applyQueue<T extends { queued?: Queued[] }>(
  t: T,
  { steering, followUp }: { steering: string[]; followUp: string[] },
): T {
  return {
    ...t,
    queued: [
      ...steering.map((text) => ({ kind: "steer" as const, text })),
      ...followUp.map((text) => ({ kind: "followUp" as const, text })),
    ],
  };
}

/** Whether the composer may send: a conversation to send to, something typed, and the router not reading a message. */
export function canSend(
  ready: boolean,
  typed: { text: string; images: number },
  routing: boolean,
) {
  return ready && !routing && (!!typed.text.trim() || typed.images > 0);
}
