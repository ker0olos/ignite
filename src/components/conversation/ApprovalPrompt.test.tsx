import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApprovalPrompt } from "./ApprovalPrompt";

it("offers to always allow what the sandbox blocked", () => {
  const onAnswer = vi.fn();
  render(<ApprovalPrompt allow="example.com" onAnswer={onAnswer} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Always allow example.com" }),
  );
  expect(onAnswer).toHaveBeenCalledWith(true, true);
});

it("offers only approve and deny otherwise", () => {
  render(<ApprovalPrompt onAnswer={vi.fn()} />);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "Approve",
    "Deny",
  ]);
});

it("titles the agent's reason with the app's", () => {
  render(
    <ApprovalPrompt
      why="Removes the test user"
      reason="May make changes: execute_sql"
      onAnswer={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
    "May make changes: execute_sql",
    "Removes the test user",
  ]);
});
