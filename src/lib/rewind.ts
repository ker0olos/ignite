import type { SessionEvent, UserMessage } from "../../shared/agentTypes";
import type { Item, Transcript } from "@/lib/transcript";

type RewindEvent = Extract<SessionEvent, { type: "message_entry" | "rewound" }>;

const userAt = (item: Item | undefined) =>
  item?.kind === "message" && item.message.role === "user"
    ? (item.message as UserMessage)
    : null;

const MISSING =
  "Files stay as they are: they weren't saved before that message.";

/** Names a saved user message by its entry, so Edit can rewind to it. */
function named(t: Transcript, timestamp: number, entryId: string) {
  const i = t.items.findLastIndex((item) => {
    const m = userAt(item);
    return m?.timestamp === timestamp && !m.entryId;
  });
  if (i < 0) return t;
  const items = t.items.slice();
  items[i] = { kind: "message", message: { ...userAt(t.items[i])!, entryId } };
  return { ...t, items };
}

/** Drops user message `entryId` and everything after it from view; says so when its files couldn't go back. */
function rewound(t: Transcript, entryId: string, files: string): Transcript {
  const i = t.items.findIndex((item) => userAt(item)?.entryId === entryId);
  if (i < 0) return t;
  const items = t.items.slice(0, i);
  if (files === "missing") items.push({ kind: "notice", text: MISSING });
  return { ...t, items };
}

/** Applies the sidecar's own events for editing messages; any other event leaves `t` as it is. */
export function applyRewindEvent(
  t: Transcript,
  event: SessionEvent,
): Transcript {
  const e = event as RewindEvent;
  if (e.type === "message_entry") return named(t, e.timestamp, e.entryId);
  if (e.type === "rewound") return rewound(t, e.entryId, e.files);
  return t;
}

/** The entry ids of the user messages Edit is offered on: those after the latest compaction. */
export function editableEntries(items: Item[]): Set<string> {
  const from = items.findLastIndex((i) => i.kind === "compaction") + 1;
  return new Set(
    items.slice(from).flatMap((item) => userAt(item)?.entryId ?? []),
  );
}

/** Whether a message can be edited now: nothing runs, routes, compacts, waits on the user or a fork, or is queued. */
export function canRewind(t: Transcript, waitingOnFork: boolean): boolean {
  const waiting = Object.values(t.tools).some((run) => run.approval);
  const compacting = t.items.some((i) => i.kind === "compaction" && !i.summary);
  return !(
    t.running ||
    t.routing ||
    waiting ||
    compacting ||
    t.queued?.length ||
    waitingOnFork
  );
}
