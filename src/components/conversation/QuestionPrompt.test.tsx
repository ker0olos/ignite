import { act, fireEvent, render, screen } from "@testing-library/react";
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

it("answers from the keyboard when it has the shortcuts", () => {
  const onAnswer = vi.fn();
  render(
    <QuestionPrompt questions={questions} shortcuts onAnswer={onAnswer} />,
  );
  const sqlite = screen.getByRole("radio", { name: /SQLite/ });
  expect(document.activeElement).toBe(sqlite);
  fireEvent.click(sqlite);
  const note = screen.getByLabelText("Note on SQLite (Recommended)");
  fireEvent.change(note, { target: { value: "fast" } });
  note.focus();
  fireEvent.keyDown(note, { key: "Enter", ctrlKey: true });
  expect(screen.getByText("2/2")).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("checkbox", { name: "macOS" }),
  );
  fireEvent.keyDown(window, { key: "n", ctrlKey: true });
  const own = screen.getByLabelText("Your own answer");
  expect(document.activeElement).toBe(own);
  expect(own.parentElement!.textContent).toContain("Ctrl+↩");
  fireEvent.keyDown(own, { key: "Enter", ctrlKey: true });
  expect(onAnswer).toHaveBeenCalledWith(true, [
    {
      question: "Where should settings live?",
      choices: [{ answer: "SQLite (Recommended)", note: "fast" }],
    },
    { question: "Which platforms?", choices: [] },
  ]);
});

it("leaves the questions to the agent from the keyboard, but not over typed text elsewhere", () => {
  const onAnswer = vi.fn();
  const outside = document.createElement("textarea");
  outside.value = "a message";
  document.body.append(outside);
  outside.focus();
  render(
    <QuestionPrompt questions={questions} shortcuts onAnswer={onAnswer} />,
  );
  expect(document.activeElement).toBe(outside);
  fireEvent.keyDown(outside, { key: "Enter", ctrlKey: true });
  fireEvent.keyDown(outside, { key: "Backspace", ctrlKey: true });
  expect(onAnswer).not.toHaveBeenCalled();
  outside.value = "";
  fireEvent.keyDown(outside, { key: "Backspace", ctrlKey: true });
  expect(onAnswer).toHaveBeenCalledWith(false);
  outside.remove();
});

it("ignores the keyboard without the shortcuts", () => {
  const onAnswer = vi.fn();
  render(<QuestionPrompt questions={questions} onAnswer={onAnswer} />);
  fireEvent.keyDown(window, { key: "Backspace", ctrlKey: true });
  expect(onAnswer).not.toHaveBeenCalled();
});

it("moves between the options and the own answer with the arrow keys", () => {
  render(<QuestionPrompt questions={questions} onAnswer={vi.fn()} />);
  const sqlite = screen.getByRole("radio", { name: /SQLite/ });
  const json = screen.getByRole("radio", { name: /JSON file/ });
  const own = screen.getByLabelText<HTMLTextAreaElement>("Your own answer");
  act(() => sqlite.focus());
  expect(sqlite.textContent).toContain("Space");
  expect(json.textContent).toContain("↓");
  fireEvent.keyDown(sqlite, { key: "ArrowUp" });
  expect(document.activeElement).toBe(sqlite);
  fireEvent.keyDown(sqlite, { key: "ArrowDown" });
  expect(document.activeElement).toBe(json);
  fireEvent.keyDown(json, { key: "ArrowDown", shiftKey: true });
  expect(document.activeElement).toBe(json);
  fireEvent.keyDown(json, { key: "ArrowDown" });
  expect(document.activeElement).toBe(own);
  fireEvent.change(own, { target: { value: "Postgres" } });
  own.setSelectionRange(3, 3);
  fireEvent.keyDown(own, { key: "ArrowUp" });
  expect(document.activeElement).toBe(own);
  own.setSelectionRange(0, 0);
  fireEvent.keyDown(own, { key: "ArrowUp" });
  expect(document.activeElement).toBe(json);
});

it("types on a picked option into its note", () => {
  render(<QuestionPrompt questions={questions} onAnswer={vi.fn()} />);
  const json = screen.getByRole("radio", { name: /JSON file/ });
  fireEvent.keyDown(json, { key: "x" });
  expect(screen.queryByLabelText("Note on JSON file")).toBeNull();
  fireEvent.click(json);
  fireEvent.keyDown(json, { key: "k" });
  const note = screen.getByLabelText<HTMLTextAreaElement>("Note on JSON file");
  expect(note.value).toBe("k");
  expect(document.activeElement).toBe(note);
});
