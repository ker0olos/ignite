import { describe, expect, it } from "vitest";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import { followSubagents, subagentsIn } from "./hostChildren.ts";
import type { Agent } from "./hostTypes.ts";

const details = (id: string, running: boolean) => ({
  id,
  model: "haiku",
  effort: "low",
  messages: [],
  running,
});
const done = (id: string) => ({
  role: "toolResult",
  toolCallId: id,
  toolName: "subagent",
  content: [],
  details: details(id, false),
});

describe("subagentsIn", () => {
  it("finds the subagents a conversation's saved calls ran, none running", () => {
    const messages = [
      { role: "user", content: "hi", timestamp: 0 },
      { ...done("agent-1"), details: details("agent-1", true) },
      done("agent-2"),
      { role: "toolResult", toolName: "bash", content: [], details: {} },
    ] as unknown as AgentMessage[];
    expect([...subagentsIn(messages).values()]).toEqual([
      { id: "agent-1", model: "haiku", running: false },
      { id: "agent-2", model: "haiku", running: false },
    ]);
  });
});

describe("followSubagents", () => {
  const agent = () => ({ subagents: new Map() }) as unknown as Agent;
  const update = (running: boolean, type = "tool_execution_update") =>
    ({
      type,
      toolCallId: "c1",
      partialResult: { content: [], details: details("agent-1", running) },
      result: { content: [], details: details("agent-1", running) },
      isError: false,
    }) as unknown as SessionEvent;

  it("tracks a subagent's calls, changing only when it starts or stops", () => {
    const a = agent();
    expect(followSubagents(a, update(true))).toBe(true);
    expect(followSubagents(a, update(true))).toBe(false);
    expect(followSubagents(a, update(false, "tool_execution_end"))).toBe(true);
    expect([...a.subagents.values()]).toEqual([
      { id: "agent-1", model: "haiku", running: false },
    ]);
  });

  it("ignores other events and other tools' results", () => {
    const a = agent();
    const other = {
      type: "tool_execution_end",
      toolCallId: "c2",
      result: { content: [], details: { diff: "" } },
      isError: false,
    } as unknown as SessionEvent;
    expect(followSubagents(a, other)).toBe(false);
    expect(followSubagents(a, { type: "agent_start" } as SessionEvent)).toBe(
      false,
    );
    expect(a.subagents.size).toBe(0);
  });

  it("marks what still runs as stopped once the run settles", () => {
    const a = agent();
    followSubagents(a, update(true));
    const settled = { type: "agent_settled" } as SessionEvent;
    expect(followSubagents(a, settled)).toBe(true);
    expect(a.subagents.get("agent-1")?.running).toBe(false);
    expect(followSubagents(a, settled)).toBe(false);
  });
});
