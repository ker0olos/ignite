import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../shared/agentTypes";
import type { SubagentDetails } from "../../shared/subagents";
import { subagentRows } from "./subagentRows";
import type { ToolRun } from "./transcript";

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
    const { tools } = subagentRows(details(messages, true), parentTools);
    expect(tools["nested-1"]).toEqual({
      status: "running",
      approval: { reason: "risky" },
    });
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
    const { tools } = subagentRows(details(messages, false), parentTools);
    expect(tools["nested-1"]).toEqual({
      status: "done",
      result: { content: [{ type: "text", text: "ok" }] },
    });
  });
});
