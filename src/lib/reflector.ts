import { TAUGHT_BY, type Reflection } from "../../shared/reflector";
import { timeAgo } from "@/lib/memory";

/** A point's origin as its line shows it: what taught it, the conversation (none for the user's edit), when. */
export function reflectionOrigin(r: Reflection, now = Date.now()) {
  return {
    taught: TAUGHT_BY[r.taught],
    conversation: r.from ? r.from.title || "Untitled conversation" : null,
    when: timeAgo(r.at, now),
    date: new Date(r.at).toLocaleString(),
  };
}
