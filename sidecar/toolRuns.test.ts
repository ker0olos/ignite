import { expect, it } from "vitest";
import type { SessionEvent } from "../shared/agentTypes.ts";
import type { Agent } from "./hostTypes.ts";
import { trackToolRun } from "./toolRuns.ts";

const event = (e: unknown) => e as SessionEvent;

it("keeps each call's latest progress until pi saves its result or the run ends", () => {
  const agent = { toolRuns: new Map() } as Agent;
  const update = event({ type: "tool_execution_update", toolCallId: "b" });
  trackToolRun(agent, event({ type: "tool_execution_start", toolCallId: "a" }));
  trackToolRun(agent, event({ type: "tool_execution_start", toolCallId: "b" }));
  trackToolRun(agent, update);
  trackToolRun(
    agent,
    event({
      type: "message_end",
      message: { role: "toolResult", toolCallId: "a" },
    }),
  );
  trackToolRun(
    agent,
    event({ type: "message_end", message: { role: "assistant", content: [] } }),
  );
  expect([...agent.toolRuns.values()]).toEqual([update]);
  trackToolRun(agent, event({ type: "agent_settled" }));
  expect(agent.toolRuns.size).toBe(0);
});

it("keeps a script's call's start beside its latest progress, as only that names the script", () => {
  const agent = { toolRuns: new Map() } as Agent;
  const start = event({
    type: "tool_execution_start",
    toolCallId: "s/1",
    parentToolCallId: "s",
  });
  const end = event({ type: "tool_execution_end", toolCallId: "s/1" });
  trackToolRun(agent, start);
  trackToolRun(agent, end);
  expect([...agent.toolRuns.values()]).toEqual([start, end]);
});
