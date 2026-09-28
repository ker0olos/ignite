import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QuestionPrompt } from "./QuestionPrompt";

const questions = [
  {
    question: "Where should settings live?",
    header: "Storage",
    options: [
      { label: "SQLite (Recommended)", description: "Queries, one file" },
      { label: "JSON file" },
    ],
  },
  {
    question: "Which platforms?",
    options: [{ label: "macOS" }, { label: "Linux" }],
    multiSelect: true,
  },
];

it("sends picked options, the user's own answer and notes", () => {
  const onAnswer = vi.fn();
  render(<QuestionPrompt questions={questions} onAnswer={onAnswer} />);
  expect(screen.getByText("Storage")).toBeTruthy();
  expect(screen.getByText("Queries, one file")).toBeTruthy();

  fireEvent.click(screen.getByRole("radio", { name: /SQLite/ }));
  fireEvent.click(screen.getByRole("radio", { name: /JSON file/ }));
  const [note] = screen.getAllByLabelText("Note for the agent");
  fireEvent.change(note, { target: { value: "keep it small" } });

  fireEvent.click(screen.getByRole("checkbox", { name: "macOS" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Linux" }));
  const [, own] = screen.getAllByLabelText("Your own answer");
  fireEvent.change(own, { target: { value: "Windows" } });

  expect(
    screen
      .getByRole("radio", { name: /JSON file/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
  expect(onAnswer).toHaveBeenCalledWith(true, [
    {
      question: "Where should settings live?",
      choices: ["JSON file"],
      note: "keep it small",
    },
    { question: "Which platforms?", choices: ["macOS", "Linux", "Windows"] },
  ]);
});

it("leaves the questions to the agent", () => {
  const onAnswer = vi.fn();
  render(<QuestionPrompt questions={questions} onAnswer={onAnswer} />);
  fireEvent.click(screen.getByRole("button", { name: "Let the agent decide" }));
  expect(onAnswer).toHaveBeenCalledWith(false);
});
