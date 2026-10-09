import type { SessionEvent } from "../shared/agentTypes.ts";
import type { Agent } from "./hostTypes.ts";

/**
 * Keeps each tool call's latest progress until pi saves its result, so a
 * conversation shown again catches up on calls that moved while it was hidden.
 */
export function trackToolRun(agent: Agent, event: SessionEvent) {
  switch (event.type) {
    case "tool_execution_start":
    case "tool_execution_update":
    case "tool_execution_end":
      agent.toolRuns.set(event.toolCallId, event);
      return;
    case "message_end":
      if ("toolCallId" in event.message)
        agent.toolRuns.delete(event.message.toolCallId);
      return;
    case "agent_settled":
      agent.toolRuns.clear();
  }
}
