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

it("steps through the deck, sending picks, the user's own answer and notes", () => {
  const onAnswer = vi.fn();
  render(<QuestionPrompt questions={questions} onAnswer={onAnswer} />);
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(screen.getByText("Storage")).toBeTruthy();
  expect(screen.getByText("Queries, one file")).toBeTruthy();
  expect(screen.queryByText("Which platforms?")).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.queryByLabelText(/^Note on/)).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: /SQLite/ }));
  expect(screen.getByLabelText("Note on SQLite (Recommended)")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /JSON file/ }));
  expect(screen.queryByLabelText("Note on SQLite (Recommended)")).toBeNull();
  fireEvent.change(screen.getByLabelText("Note on JSON file"), {
    target: { value: "keep it small" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("2/2")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "macOS" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Linux" }));
  fireEvent.change(screen.getByLabelText("Note on Linux"), {
    target: { value: "Ubuntu only" },
  });
  fireEvent.change(screen.getByLabelText("Your own answer"), {
    target: { value: "Windows" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(
    screen
      .getByRole("radio", { name: /JSON file/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
  expect(onAnswer).toHaveBeenCalledWith(true, [
    {
      question: "Where should settings live?",
      choices: [{ answer: "JSON file", note: "keep it small" }],
    },
    {
      question: "Which platforms?",
      choices: [
        { answer: "macOS" },
        { answer: "Linux", note: "Ubuntu only" },
        { answer: "Windows" },
      ],
    },
  ]);
});

it("shows a single question without a counter, sending at once", () => {
  const onAnswer = vi.fn();
  render(
    <QuestionPrompt questions={questions.slice(0, 1)} onAnswer={onAnswer} />,
  );
  expect(screen.queryByText("1/1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
  expect(onAnswer).toHaveBeenCalledWith(true, [
    { question: "Where should settings live?", choices: [] },
  ]);
});

it("draws nothing without questions", () => {
  const { container } = render(
    <QuestionPrompt questions={[]} onAnswer={vi.fn()} />,
  );
  expect(container.innerHTML).toBe("");
});

it("leaves the questions to the agent", () => {
  const onAnswer = vi.fn();
  render(<QuestionPrompt questions={questions} onAnswer={onAnswer} />);
  fireEvent.click(screen.getByRole("button", { name: "Let the agent decide" }));
  expect(onAnswer).toHaveBeenCalledWith(false);
});
