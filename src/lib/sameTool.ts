import {
  ARTIFACT_TOOL,
  AUDIO_TOOL,
  IMAGE_TOOL,
  LEGACY_HTML_TOOL,
  VIDEO_TOOL,
  type ToolCall,
} from "../../shared/agentTypes";
import { CODEMODE_TOOL } from "../../shared/codemode";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../../shared/lessons";
import { ASK_TOOL } from "../../shared/questions";
import { SUBAGENT_TOOL } from "../../shared/subagents";
import { TASK_ADD_TOOL, TASK_TOOL } from "../../shared/tasks";
import { READ_TOOLS } from "./approvalPolicy";
import { mcpCall } from "./mcpToolCall";
import { toolTitle } from "./toolLabels";
import type { Row } from "./toolRows";

// Tools with cards of their own always get a row each.
const ALONE = new Set([
  CODEMODE_TOOL,
  ASK_TOOL,
  SUBAGENT_TOOL,
  TASK_ADD_TOOL,
  TASK_TOOL,
  ARTIFACT_TOOL,
  LEGACY_HTML_TOOL,
  IMAGE_TOOL,
  AUDIO_TOOL,
  VIDEO_TOOL,
  LESSON_ADD_TOOL,
  LESSON_REMOVE_TOOL,
]);

/** Whether a call only looks at files; consecutive ones share one Explore row. */
export function exploreCall(call: ToolCall) {
  return READ_TOOLS.has(call.name);
}

// What a call shares with the calls beside it to sit under one tile: its tool's title, or its MCP server; null when it stays alone.
function sameToolKey(call: ToolCall): string | null {
  if (ALONE.has(call.name)) return null;
  if (exploreCall(call)) return "explore";
  const mcp = mcpCall(call.name, call.arguments);
  if (mcp)
    return mcp.kind === "call" && mcp.server ? `mcp:${mcp.server}` : null;
  return toolTitle(call);
}

const callsOf = (row: Row) =>
  row.kind === "tool" ? [row.call] : row.kind === "calls" ? row.calls : [];

/** `rows` with consecutive calls of one tool (or one MCP server) as one `calls` row, every call still shown. */
export function sameToolRuns(rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    const last = out.at(-1);
    const prev = last ? callsOf(last) : [];
    const key = row.kind === "tool" ? sameToolKey(row.call) : null;
    if (row.kind === "tool" && key && prev[0] && sameToolKey(prev[0]) === key) {
      out[out.length - 1] = { kind: "calls", calls: [...prev, row.call] };
    } else {
      out.push(row);
    }
  }
  return out;
}
