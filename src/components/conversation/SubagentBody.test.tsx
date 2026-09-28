import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AgentMessage } from "../../../shared/agentTypes";
import type { SubagentDetails } from "../../../shared/subagents";
import { DEFAULT_CODE_THEMES } from "@/lib/codeThemes";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { ToolRun } from "@/lib/transcript";
import { SubagentBody } from "./SubagentBody";

const messages: AgentMessage[] = [
  { role: "user", content: "Rename the helper", timestamp: 0 },
  {
    role: "assistant",
    content: [
      { type: "toolCall", id: "nested-1", name: "bash", arguments: {} },
    ],
    provider: "anthropic",
    model: "claude-haiku",
    stopReason: "toolUse",
    timestamp: 1,
  },
];

const details: SubagentDetails = {
  id: "agent-1",
  model: "claude-haiku",
  effort: "low",
  messages,
  running: true,
};

it("shows the subagent's task and a nested approval, forwarding the nested id", () => {
  const onApprove = vi.fn();
  const tools: Record<string, ToolRun> = {
    "nested-1": { status: "running", approval: { reason: "Deletes files" } },
  };
  render(
    <SubagentBody
      details={details}
      tools={tools}
      folder="/repo"
      editor={DEFAULT_SETTINGS.editor}
      codeThemes={DEFAULT_CODE_THEMES}
      onApprove={onApprove}
    />,
  );

  expect(screen.getByText("Rename the helper")).toBeTruthy();
  expect(screen.getByText("Deletes files")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(onApprove).toHaveBeenCalledWith("nested-1", true);
});
