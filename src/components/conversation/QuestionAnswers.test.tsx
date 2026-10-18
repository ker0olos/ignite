import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { withFiles } from "../../../shared/attachedFiles";
import { QuestionAnswers } from "./QuestionAnswers";

it("shows each question with its choices, note and images", () => {
  render(
    <QuestionAnswers
      answers={[
        {
          question: "Where?",
          choices: ["SQLite", "JSON file"],
          note: "keep it small",
          images: 1,
        },
        { question: "Which?", choices: ["A"], images: 2 },
      ]}
    />,
  );
  expect(screen.getByText("Where?")).toBeTruthy();
  expect(screen.getByText("SQLite, JSON file")).toBeTruthy();
  expect(screen.getByText("keep it small")).toBeTruthy();
  expect(screen.getByText("1 image")).toBeTruthy();
  expect(screen.getByText("2 images")).toBeTruthy();
});

it("says when a question was left to the agent", () => {
  render(<QuestionAnswers answers={[{ question: "Where?", choices: [] }]} />);
  expect(screen.getByText("Left to the agent")).toBeTruthy();
  expect(screen.queryByText(/image/)).toBeNull();
});

it("says when a question was answered with images alone", () => {
  render(
    <QuestionAnswers
      answers={[{ question: "Where?", choices: [], images: 2 }]}
    />,
  );
  expect(screen.getByText("Answered with images")).toBeTruthy();
  expect(screen.getByText("2 images")).toBeTruthy();
});

it("shows files in a note as cards, not their text", () => {
  render(
    <QuestionAnswers
      answers={[
        {
          question: "Which file?",
          choices: [],
          note: withFiles("", [{ path: "/d/report.pdf" }]),
        },
      ]}
    />,
  );
  expect(screen.getByText("Answered with files")).toBeTruthy();
  expect(screen.getByText("report.pdf")).toBeTruthy();
  expect(screen.queryByText(/attached_files/)).toBeNull();
});
