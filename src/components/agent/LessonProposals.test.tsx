import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Proposal } from "../../../shared/lessons";
import { LessonProposals } from "./LessonProposals";

const lesson: Proposal = {
  kind: "lesson",
  id: "l1",
  text: "Never force-push",
  level: "tool_call",
  tool: "git",
  folderOnly: false,
  evidence: "denied push --force",
};

const skill: Proposal = {
  kind: "skill",
  id: "s1",
  skill: "release-notes",
  description: "When writing release notes",
  add: "## Keep it short",
  evidence: "rewound a long draft",
};

describe("LessonProposals", () => {
  it("shows nothing without proposals", () => {
    const { container } = render(
      <LessonProposals lessons={[]} error={null} onAnswer={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows lessons and skill sections, each answered by its id", () => {
    const onAnswer = vi.fn();
    render(
      <LessonProposals
        lessons={[
          lesson,
          skill,
          { ...skill, id: "s2", description: undefined },
        ]}
        error="30 lessons already"
        onAnswer={onAnswer}
      />,
    );
    expect(screen.getByText("Never force-push")).toBeTruthy();
    expect(screen.getByText("New skill")).toBeTruthy();
    expect(screen.getByText("Add to skill")).toBeTruthy();
    expect(screen.getAllByText("## Keep it short")).toHaveLength(2);
    expect(screen.getByText("30 lessons already")).toBeTruthy();
    const keep = screen.getAllByRole("button", { name: "Keep" });
    const discard = screen.getAllByRole("button", { name: "Discard" });
    fireEvent.click(keep[1]);
    fireEvent.click(discard[0]);
    expect(onAnswer.mock.calls).toEqual([
      ["s1", true],
      ["l1", false],
    ]);
  });
});
