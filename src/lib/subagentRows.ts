import type { AssistantMessage } from "../../shared/agentTypes";
import {
  readSubagent,
  SUBAGENT_TOOL,
  type SubagentDetails,
} from "../../shared/subagents";
import {
  fromHistory,
  type RunState,
  type ToolRun,
  type Transcript,
} from "./transcript";
import { firstWaiting, toRows, type Row } from "./toolRows";

/** Rows for a subagent's own conversation, its tool runs merged over the parent's; `waiting` while one of its calls waits for the user. */
export function subagentRows(
  details: SubagentDetails,
  tools: Record<string, ToolRun> | undefined,
): { rows: Row[]; tools: Record<string, ToolRun>; waiting: boolean } {
  const t = fromHistory(details.messages, details.running);
  const runs = { ...tools, ...t.tools };
  return {
    rows: toRows(t.items, false, runs),
    tools: runs,
    waiting: firstWaiting(t.items, runs) !== null,
  };
}

/**
 * Everything subagent `id` did in a conversation: each call's messages,
 * joined in order, running while its latest call runs. Null until a call
 * reports it.
 */
export function subagentConversation(
  transcript: Transcript,
  id: string,
): SubagentDetails | null {
  const calls = transcript.items.flatMap((item) =>
    item.kind === "message" && item.message.role === "assistant"
      ? (item.message as AssistantMessage).content.filter(
          (b) => b.type === "toolCall" && b.name === SUBAGENT_TOOL,
        )
      : [],
  );
  const parts = calls
    .map((c) =>
      readSubagent(transcript.tools[(c as { id: string }).id]?.result?.details),
    )
    .filter((d): d is SubagentDetails => d?.id === id);
  if (!parts.length) return null;
  return {
    ...parts[parts.length - 1],
    messages: parts.flatMap((p) => p.messages),
  };
}

/** Where a subagent stands: working, waiting for the user on one of its calls, or finished. */
export function runState(
  details: SubagentDetails,
  tools: Record<string, ToolRun>,
): RunState {
  if (!details.running) return "finished";
  return subagentRows(details, tools).waiting ? "waiting" : "working";
}
