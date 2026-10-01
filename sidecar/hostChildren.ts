/** What runs under a conversation: its subagents (from its subagent tool calls) and background commands. */
import type {
  AgentMessage,
  SessionEvent,
  ToolResultMessage,
} from "../shared/agentTypes.ts";
import type { ChildRuns, SubagentStatus } from "../shared/agentStatus.ts";
import { readSubagent } from "../shared/subagents.ts";
import { backgroundOf } from "./backgroundBash.ts";
import type { Agent } from "./hostTypes.ts";

const status = (details: unknown): SubagentStatus | undefined => {
  const d = readSubagent(details);
  return d && { id: d.id, model: d.model, running: d.running };
};

/** The subagents a conversation's saved messages show, none running. */
export function subagentsIn(
  messages: AgentMessage[],
): Map<string, SubagentStatus> {
  const found = new Map<string, SubagentStatus>();
  for (const m of messages) {
    const result = m.role === "toolResult" ? (m as ToolResultMessage) : null;
    const s = result && status(result.details);
    if (s) found.set(s.id, { ...s, running: false });
  }
  return found;
}

const detailsOf = (event: SessionEvent): unknown => {
  if (event.type === "tool_execution_update")
    return event.partialResult?.details;
  if (event.type === "tool_execution_end") return event.result?.details;
  return undefined;
};

/** Updates `agent.subagents` from one of its session's events; true when that changed what the sidebar shows. */
export function followSubagents(agent: Agent, event: SessionEvent): boolean {
  if (event.type === "agent_settled") {
    const running = [...agent.subagents.values()].filter((s) => s.running);
    running.forEach((s) => agent.subagents.set(s.id, { ...s, running: false }));
    return running.length > 0;
  }
  const next = status(detailsOf(event));
  if (!next) return false;
  const before = agent.subagents.get(next.id);
  if (before?.running === next.running) return false;
  agent.subagents.set(next.id, next);
  return true;
}

/** A conversation's subagents and background commands, as its sidebar row lists them. */
export function childrenOf(agent: Agent): ChildRuns {
  const subagents = [...agent.subagents.values()];
  const background = backgroundOf(agent.id).map(
    ({ pid, command, running }) => ({ pid, command, running }),
  );
  return {
    ...(subagents.length && { subagents }),
    ...(background.length && { background }),
  };
}
