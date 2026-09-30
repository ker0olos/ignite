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
