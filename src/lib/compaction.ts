import type {
  AgentMessage,
  CompactionSummaryMessage,
  SessionEvent,
} from "../../shared/agentTypes";
import type { Item, Transcript } from "@/lib/transcript";

/**
 * Compaction in the conversation: running while `summary` is unset, with the
 * tokens its summary has `written` so far, then what replaced the older messages.
 */
export type CompactionItem = {
  kind: "compaction";
  summary?: string;
  tokensBefore?: number;
  written?: number;
};

type CompactionEvent = Extract<
  SessionEvent,
  { type: "compaction_start" | "compaction_progress" | "compaction_end" }
>;

const running = (items: Item[]) =>
  items.findLastIndex((x) => x.kind === "compaction" && !x.summary);

function outcome(
  event: Extract<CompactionEvent, { type: "compaction_end" }>,
): Item {
  if (event.result) {
    const { summary, tokensBefore } = event.result;
    return { kind: "compaction", summary, tokensBefore };
  }
  if (event.aborted) return { kind: "notice", text: "Compaction stopped" };
  const text = event.errorMessage ?? "Compaction failed.";
  return { kind: "notice", text, error: true };
}

/**
 * Shows compaction while it runs, then its summary in its place. `/compact`
 * runs outside a run, so it counts as one: the working line shows and Stop
 * ends it.
 */
export function applyCompactionEvent(
  t: Transcript,
  event: CompactionEvent,
): Transcript {
  if (event.type === "compaction_progress") {
    const i = running(t.items);
    if (i < 0) return t;
    const items = t.items.slice();
    items[i] = { kind: "compaction", written: event.tokens };
    return { ...t, items };
  }
  const manual = event.reason === "manual";
  if (event.type === "compaction_start") {
    const items: Item[] = [...t.items, { kind: "compaction" }];
    return { ...t, items, ...(manual && { running: true }) };
  }
  const items = t.items.slice();
  const i = running(items);
  if (i < 0) items.push(outcome(event));
  else items[i] = outcome(event);
  return { ...t, items, ...(manual && { running: false }) };
}

/** A saved conversation's compaction summary as its item, or null for any other message. */
export function compactionOf(message: AgentMessage): CompactionItem | null {
  if (message.role !== "compactionSummary") return null;
  const { summary, tokensBefore } = message as CompactionSummaryMessage;
  return { kind: "compaction", summary, tokensBefore };
}

/** A token count as the divider words it: 840, 12k, 1.2M. */
export function tokenCount(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

// Summaries run a few thousand tokens; the bar nears full as one does, never claiming done early.
const TYPICAL_SUMMARY = 2000;

/** How full the progress bar is, 0 to 0.95, for the tokens a summary has written so far. */
export const summaryProgress = (written = 0) =>
  0.95 * (1 - Math.exp(-written / TYPICAL_SUMMARY));
