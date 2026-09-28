import type { SubagentDetails } from "../../shared/subagents";
import { fromHistory, type ToolRun } from "./transcript";
import { toRows, type Row } from "./toolRows";

/** Rows for a subagent's own conversation, its tool runs merged over the parent's. */
export function subagentRows(
  details: SubagentDetails,
  tools: Record<string, ToolRun> | undefined,
): { rows: Row[]; tools: Record<string, ToolRun> } {
  const t = fromHistory(details.messages, details.running);
  const runs = { ...tools, ...t.tools };
  return { rows: toRows(t.items, false, runs), tools: runs };
}
