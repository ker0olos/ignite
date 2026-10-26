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
