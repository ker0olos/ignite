import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ASK_TOOL } from "../../../shared/questions";
import { WaitingCallsContext } from "@/hooks/useWaitingPlace";
import { WaitingPrompt } from "./WaitingPrompt";

const ask = (id: string) => ({
  type: "toolCall" as const,
  id,
  name: ASK_TOOL,
  arguments: {
    questions: [{ question: `Question ${id}?`, options: [{ label: "Yes" }] }],
  },
});

const show = (id: string, queue: string[]) =>
  render(
    <WaitingCallsContext.Provider value={queue}>
      <WaitingPrompt
        call={ask(id)}
        approval={{}}
        editor={{ font_family: "Menlo", word_wrap: false }}
        codeThemes={{ light: "github-light", dark: "github-dark" } as never}
        onApprove={vi.fn()}
      />
    </WaitingCallsContext.Provider>,
  );

it("shows the first waiting call in full", () => {
  show("a", ["a", "b"]);
  expect(screen.getByText("Question a?")).toBeTruthy();
});

it("shows a later one only as its place in line", () => {
  show("b", ["a", "b"]);
  expect(screen.queryByText("Question b?")).toBeNull();
  expect(screen.getByText("Waiting · 2/2")).toBeTruthy();
});

it("shows a call outside the line in full", () => {
  show("c", ["a"]);
  expect(screen.getByText("Question c?")).toBeTruthy();
});
