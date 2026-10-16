import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ASK_TOOL } from "../../../shared/questions";
import { AskingStepContext } from "@/components/conversation/shared";
import { WaitingCallsContext } from "@/hooks/useWaitingPlace";
import { WaitingPrompt } from "./WaitingPrompt";

const ask = (id: string, n: number) => ({
  type: "toolCall" as const,
  id,
  name: ASK_TOOL,
  arguments: {
    questions: Array.from({ length: n }, (_, i) => ({
      question: `Question ${id}${i}?`,
      options: [{ label: "Yes" }],
    })),
  },
});

const show = (id: string, queue: string[], n = 1, step = 0) =>
  render(
    <WaitingCallsContext.Provider value={queue}>
      <AskingStepContext.Provider value={step}>
        <WaitingPrompt
          call={ask(id, n)}
          approval={{}}
          editor={{ font_family: "Menlo", word_wrap: false }}
          codeThemes={{ light: "github-light", dark: "github-dark" } as never}
          onApprove={vi.fn()}
        />
      </AskingStepContext.Provider>
    </WaitingCallsContext.Provider>,
  );

it("shows the first waiting call as the composer's to answer", () => {
  show("a", ["a", "b"]);
  expect(screen.getByText("Asking you")).toBeTruthy();
  expect(screen.queryByText("Question a0?")).toBeNull();
});

it("counts the questions only when there are several", () => {
  show("a", ["a"], 2);
  expect(screen.getByText("Asking you · 1 of 2")).toBeTruthy();
});

it("follows the question the composer is on", () => {
  show("a", ["a"], 3, 1);
  expect(screen.getByText("Asking you · 2 of 3")).toBeTruthy();
});

it("shows a later one only as its place in line", () => {
  show("b", ["a", "b"]);
  expect(screen.queryByText(/Asking you/)).toBeNull();
  expect(screen.getByText("Waiting · 2/2")).toBeTruthy();
});

it("shows a call outside the line as asking", () => {
  show("c", ["a"]);
  expect(screen.getByText("Asking you")).toBeTruthy();
});
