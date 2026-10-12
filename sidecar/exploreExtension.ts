/** Tells the agent how to explore the code before answering, the way Claude Code's prompt does; adds grep's `filesOnly`, `outline`, read's smaller window and edit's changed lines, and sends bash file searches to the tools. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadBashParser } from "./bashParser.ts";
import { onlySearches, USE_READ_TOOLS } from "./bashSearch.ts";
import { registerEdit } from "./editContext.ts";
import { registerGrep } from "./grepFiles.ts";
import { registerOutline, registerRead } from "./readTools.ts";

/** How to search the folder before answering or changing it. */
export const EXPLORE_GUIDANCE = `Exploring the code:
- Search before you answer a question about the code; never answer from guesses about files you haven't read.
- Read and search with read, grep, find and ls, not cat, sed, head or grep in bash.
- Every turn costs time, so batch: make independent calls together in one turn, and read several files, ranges or definitions in one read call with also.
- Start broad (grep with filesOnly to see where terms appear, outline a folder to see its files and what they define), outline long files, then read only what matters: a range, or one definition with symbol.
- Follow the flow end to end: callers, definitions, where the data comes from. Don't stop at the first hit.
- For a wide sweep across many files, start a subagent with explore: true (when you have one) and ask for its conclusion with file:line references, not file contents.
- Stop searching once you can answer with specific file:line references, and cite them.
- An edit's result shows the changed lines as they now read; edit nearby from them instead of searching the file again.`;

const bashParser = loadBashParser().catch(() => undefined);

export default function explore(pi: ExtensionAPI) {
  registerGrep(pi);
  registerRead(pi);
  registerOutline(pi);
  registerEdit(pi);
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${EXPLORE_GUIDANCE}`,
  }));
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const { command } = event.input as { command?: unknown };
    if (typeof command !== "string") return;
    const pipelines = (await bashParser)?.(command);
    if (pipelines && onlySearches(pipelines, ctx.cwd)) {
      return { block: true, reason: USE_READ_TOOLS };
    }
  });
}
