import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../shared/agentTypes";
import type { SubagentDetails } from "../../shared/subagents";
import { runState, subagentConversation, subagentRows } from "./subagentRows";
import type { ToolRun, Transcript } from "./transcript";

const details = (
  messages: AgentMessage[],
  running = false,
): SubagentDetails => ({
  id: "agent-1",
  model: "claude-haiku",
  effort: "low",
  messages,
  running,
});

describe("subagentRows", () => {
  it("builds rows from the subagent's own messages", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Do the thing", timestamp: 0 },
      {
        role: "assistant",
        content: [{ type: "text", text: "Done." }],
        provider: "anthropic",
        model: "claude-haiku",
        stopReason: "stop",
        timestamp: 1,
      },
    ];
    const { rows } = subagentRows(details(messages), undefined);
    expect(rows).toEqual([
      { kind: "user", message: messages[0] },
      { kind: "text", text: "Done." },
    ]);
  });

  it("keeps a parent approval for a nested tool call still waiting", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "nested-1", name: "bash", arguments: {} },
        ],
        provider: "anthropic",
        model: "claude-haiku",
        stopReason: "toolUse",
        timestamp: 0,
      },
    ];
    const parentTools: Record<string, ToolRun> = {
      "nested-1": { status: "running", approval: { reason: "risky" } },
    };
    const { tools, waiting } = subagentRows(
      details(messages, true),
      parentTools,
    );
    expect(tools["nested-1"]).toEqual({
      status: "running",
      approval: { reason: "risky" },
    });
    expect(waiting).toBe(true);
  });

  it("lets a nested finished result win over the parent's stale running entry", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "nested-1", name: "bash", arguments: {} },
        ],
        provider: "anthropic",
        model: "claude-haiku",
        stopReason: "toolUse",
        timestamp: 0,
      },
      {
        role: "toolResult",
        toolCallId: "nested-1",
        toolName: "bash",
        isError: false,
        content: [{ type: "text", text: "ok" }],
        timestamp: 1,
      },
    ];
    const parentTools: Record<string, ToolRun> = {
      "nested-1": { status: "running", approval: { reason: "risky" } },
    };
    const { tools, waiting } = subagentRows(
      details(messages, false),
      parentTools,
    );
    expect(waiting).toBe(false);
    expect(tools["nested-1"]).toEqual({
      status: "done",
      result: { content: [{ type: "text", text: "ok" }] },
    });
  });
});

describe("subagentConversation", () => {
  const say = (text: string): AgentMessage => ({
    role: "user",
    content: text,
    timestamp: 0,
  });
  const calls = (...ids: string[]): Transcript["items"] => [
    {
      kind: "message",
      message: {
        role: "assistant",
        content: ids.map((id) => ({
          type: "toolCall" as const,
          id,
          name: id === "b1" ? "bash" : "subagent",
          arguments: {},
        })),
        provider: "anthropic",
        model: "claude-opus",
        stopReason: "toolUse",
        timestamp: 0,
      },
    },
    { kind: "notice", text: "retrying" },
  ];
  const run = (d: SubagentDetails): ToolRun => ({
    status: d.running ? "running" : "done",
    result: { content: [], details: d },
  });

  it("joins a subagent's calls in order, running while its latest runs", () => {
    const transcript: Transcript = {
      items: calls("c1", "b1", "c2", "c3"),
      tools: {
        c1: run(details([say("first")])),
        b1: { status: "done", result: { content: [], details: {} } },
        c2: run({ ...details([say("other")]), id: "agent-2" }),
        c3: run(details([say("second")], true)),
      },
      running: true,
    };
    expect(subagentConversation(transcript, "agent-1")).toEqual(
      details([say("first"), say("second")], true),
    );
  });

  it("is null until one of its calls reports it", () => {
    const transcript: Transcript = {
      items: calls("c1"),
      tools: { c1: { status: "running" } },
      running: true,
    };
    expect(subagentConversation(transcript, "agent-1")).toBeNull();
  });
});

describe("runState", () => {
  const call: AgentMessage = {
    role: "assistant",
    content: [{ type: "toolCall", id: "n1", name: "bash", arguments: {} }],
    provider: "anthropic",
    model: "claude-haiku",
    stopReason: "toolUse",
    timestamp: 0,
  };

  it("is finished once it stops, working while it runs, waiting on an approval", () => {
    expect(runState(details([call]), {})).toBe("finished");
    expect(runState(details([call], true), {})).toBe("working");
    const asking = { n1: { status: "running" as const, approval: {} } };
    expect(runState(details([call], true), asking)).toBe("waiting");
  });
});
