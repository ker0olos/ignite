import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SubagentDetails } from "../../../shared/subagents";
import { DEFAULT_CODE_THEMES } from "@/lib/codeThemes";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { ToolRun } from "@/lib/transcript";
import { SubagentSummary } from "./SubagentSummary";

const details: SubagentDetails = {
  id: "agent-1",
  model: "claude-haiku",
  effort: "low",
  messages: [
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
  ],
  running: true,
};

const show = (tools: Record<string, ToolRun>) =>
  render(
    <SubagentSummary
      details={details}
      tools={tools}
      folder="/repo"
      editor={DEFAULT_SETTINGS.editor}
      codeThemes={DEFAULT_CODE_THEMES}
      onApprove={vi.fn()}
    />,
  );

it("shows one line, opening to the subagent's conversation", () => {
  show({ "nested-1": { status: "running" } });
  expect(screen.queryByText("Rename the helper")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /1 tool call/ }));
  expect(screen.getByText("Rename the helper")).toBeTruthy();
});

it("says it's waiting to start before it reports anything", () => {
  render(
    <SubagentSummary
      details={null}
      tools={{}}
      folder="/repo"
      editor={DEFAULT_SETTINGS.editor}
      codeThemes={DEFAULT_CODE_THEMES}
      onApprove={vi.fn()}
    />,
  );
  expect(screen.getByText("Waiting to start")).toBeTruthy();
});

it("stays open while a nested call waits for the user", () => {
  show({ "nested-1": { status: "running", approval: { reason: "Deletes" } } });
  expect(screen.getByText("Deletes")).toBeTruthy();
});
