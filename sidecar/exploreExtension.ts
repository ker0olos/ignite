/** Tells the agent how to explore the code before answering, the way Claude Code's prompt does; adds grep's `filesOnly`, `outline` and read's smaller window. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerGrep } from "./grepFiles.ts";
import { registerOutline, registerRead } from "./readTools.ts";

/** How to search the folder before answering or changing it. */
export const EXPLORE_GUIDANCE = `Exploring the code:
- Search before you answer a question about the code; never answer from guesses about files you haven't read.
- Read and search with read, grep, find and ls, not cat, sed, head or grep in bash.
- Every turn costs time, so batch: make independent calls together in one turn, and read several files, ranges or definitions in one read call with also.
- Start broad (grep with filesOnly to see where terms appear, find likely files), outline long files, then read only what matters: a range, or one definition with symbol.
- Follow the flow end to end: callers, definitions, where the data comes from. Don't stop at the first hit.
- For a wide sweep across many files, start a subagent with explore: true (when you have one) and ask for its conclusion with file:line references, not file contents.
- Stop searching once you can answer with specific file:line references, and cite them.`;

export default function explore(pi: ExtensionAPI) {
  registerGrep(pi);
  registerRead(pi);
  registerOutline(pi);
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${EXPLORE_GUIDANCE}`,
  }));
}
