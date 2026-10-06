import type { RouterPick, SessionEvent } from "../../shared/agentTypes";
import type { ThinkingLevel } from "../../shared/hostProtocol";
import { EFFORT_LABELS, modelLabel } from "@/lib/modelMenu";
import type { Item, Transcript } from "@/lib/transcript";

type RoutingEvent = Extract<
  SessionEvent,
  { type: "routing_start" | "routing_end" }
>;

/** A routing event: sent on, the message stays shown until pi's copy arrives; dropped, it goes. */
export function applyRouting(t: Transcript, event: RoutingEvent): Transcript {
  if (event.type === "routing_start") {
    const routedAt = event.message.timestamp;
    return {
      ...t,
      running: true,
      routing: true,
      pending: event.message,
      routedAt,
    };
  }
  if (!event.sent) return { ...ended(t), routing: false };
  const note = event.picked && pickNote(event.picked);
  const items: Item[] = note
    ? [...t.items, { kind: "notice", text: note }]
    : t.items;
  return { ...t, routing: false, items };
}

/** What the router chose, as the line above the first message says it. */
export function pickNote({ model, effort, kept }: RouterPick): string | null {
  if (!model) return null;
  const level = EFFORT_LABELS[effort as ThinkingLevel] ?? effort;
  const pick = `${modelLabel(model)} · ${level}`;
  return kept ? `Router kept your default, ${pick}` : `Router picked ${pick}`;
}

/** `t` with its run over: not running, and nothing routed shown or timed. */
export function ended(t: Transcript): Transcript {
  return { ...t, running: false, pending: undefined, routedAt: undefined };
}

/** The transcript's items, with the message being routed last. */
export function shownItems(t: Transcript): Item[] {
  return t.pending
    ? [...t.items, { kind: "message", message: t.pending }]
    : t.items;
}
