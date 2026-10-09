/** Adds what the conversation's forks reported (and forks made of it) to its next run. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { takeNotes } from "./forks.ts";

export default function forks(pi: ExtensionAPI) {
  pi.on("before_agent_start", (_event, ctx) => {
    const notes = takeNotes(ctx.sessionManager.getSessionId());
    if (!notes.length) return;
    return {
      message: {
        customType: "fork",
        content: notes.join("\n\n---\n\n"),
        display: false,
      },
    };
  });
}
