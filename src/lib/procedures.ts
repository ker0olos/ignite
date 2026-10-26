import type { Procedure } from "../../shared/procedures";
import { timeAgo } from "@/lib/memory";

/** A procedure's origin as its row shows it: the conversation it was learned in (if known) and when. */
export function procedureOrigin(p: Procedure, now = Date.now()) {
  return {
    conversation: p.from ? p.from.title || "Untitled conversation" : null,
    when: timeAgo(p.at, now),
    date: new Date(p.at).toLocaleString(),
  };
}

/** Splits text at its backtick spans; an unclosed backtick stays literal. */
export function codeParts(text: string): { text: string; code: boolean }[] {
  return text
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((t) =>
      /^`[^`]+`$/.test(t)
        ? { text: t.slice(1, -1), code: true }
        : { text: t, code: false },
    );
}
