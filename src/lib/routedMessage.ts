import type {
  RouterPick,
  SessionEvent,
  UserMessage,
} from "../../shared/agentTypes";
import type { ThinkingLevel } from "../../shared/hostProtocol";
import { EFFORT_LABELS, modelLabel } from "@/lib/modelMenu";
import { EMPTY, type Item, type Transcript } from "@/lib/transcript";

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
  return kept ? `Router kept ${pick}` : `Router picked ${pick}`;
}

/** `t` with its run over: not running, and nothing routed shown or timed. */
export function ended(t: Transcript): Transcript {
  return { ...t, running: false, pending: undefined, routedAt: undefined };
}

/** A folder's first message while its conversation starts; `session` once known. */
export type Starting = {
  folder: string;
  message: UserMessage;
  /** The id the app picked for its conversation, known before it opens. */
  id?: string;
  session?: string;
  /** pi has it: the sidecar says whether it runs. */
  handed?: boolean;
};

/** Whether pi has added a conversation's first message, or anything else (its run failed first). */
export const addedFirst = (t: Transcript | null) => !!t?.items.length;

/** `t`, the transcript `session` of `folder` shows, with `starting` as its message being sent until pi adds its own copy. */
export function withStarting(
  t: Transcript | null,
  starting: Starting | null,
  folder: string | null,
  session: string | null,
): Transcript | null {
  if (!starting || starting.folder !== folder) return t;
  if ((starting.session ?? null) !== session || addedFirst(t)) return t;
  return {
    ...(t ?? EMPTY),
    running: true,
    pending: t?.pending ?? starting.message,
  };
}

/** The transcript's items, with the message being routed last. */
export function shownItems(t: Transcript): Item[] {
  return t.pending
    ? [...t.items, { kind: "message", message: t.pending }]
    : t.items;
}
