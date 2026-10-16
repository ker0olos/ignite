import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { askCall } from "@/test/askCall";
import { QuestionHarness } from "@/test/QuestionHarness";

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

const show = (qs = questions) => {
  const onApprove = vi.fn();
  render(<QuestionHarness call={askCall("q1", qs)} onApprove={onApprove} />);
  return onApprove;
};
const radio = (name: RegExp) => screen.getByRole("radio", { name });
const box = () => screen.getByLabelText<HTMLTextAreaElement>("Composer");
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));

it("shows the counter, header and options of the first question", () => {
  show();
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(screen.getByText("Storage")).toBeTruthy();
  expect(screen.getByText("Queries, one file")).toBeTruthy();
  expect(screen.queryByText("Which platforms?")).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.queryByText(/^Note on/)).toBeNull();
});

it("shows a single question without a counter, sending at once", () => {
  const onApprove = show(questions.slice(0, 1));
  expect(screen.queryByText("1/1")).toBeNull();
  click("Send answers");
  expect(onApprove).toHaveBeenCalledWith("q1", true, [
    { question: "Where should settings live?", choices: [] },
  ]);
});

it("picks one radio at a time", () => {
  show();
  fireEvent.click(radio(/SQLite/));
  fireEvent.click(radio(/JSON file/));
  expect(radio(/SQLite/).getAttribute("aria-checked")).toBe("false");
  expect(radio(/JSON file/).getAttribute("aria-checked")).toBe("true");
});

it("names what the text is a note on", () => {
  show();
  fireEvent.click(radio(/JSON file/));
  expect(screen.getByText("Note on JSON file")).toBeTruthy();
  click("Next");
  expect(screen.getByText("Pick any that apply")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "macOS" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Linux" }));
  expect(screen.getByText("Note on your 2 picks")).toBeTruthy();
});

it("sends the text as a note on picks, else as the answer", () => {
  const onApprove = show();
  fireEvent.click(radio(/JSON file/));
  fireEvent.change(box(), { target: { value: " keep it small " } });
  click("Next");
  fireEvent.change(box(), { target: { value: "Windows" } });
  click("Send answers");
  expect(onApprove).toHaveBeenCalledWith("q1", true, [
    {
      question: "Where should settings live?",
      choices: ["JSON file"],
      note: "keep it small",
    },
    { question: "Which platforms?", choices: ["Windows"] },
  ]);
});

it("keeps earlier answers when going back", () => {
  const onApprove = show();
  fireEvent.click(radio(/JSON file/));
  click("Next");
  click("Back");
  expect(radio(/JSON file/).getAttribute("aria-checked")).toBe("true");
  click("Next");
  click("Send answers");
  expect(onApprove.mock.calls[0][2][0].choices).toEqual(["JSON file"]);
});

it("leaves the questions to the agent", () => {
  const onApprove = show();
  click("Let the agent decide");
  expect(onApprove).toHaveBeenCalledWith("q1", false);
});

it("starts a new call afresh", () => {
  const onApprove = vi.fn();
  const { rerender } = render(
    <QuestionHarness call={askCall("q1", questions)} onApprove={onApprove} />,
  );
  fireEvent.click(radio(/JSON file/));
  click("Next");
  rerender(
    <QuestionHarness call={askCall("q2", questions)} onApprove={onApprove} />,
  );
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(radio(/JSON file/).getAttribute("aria-checked")).toBe("false");
});

it("shows a half-answered question as it was after a reload, until it's answered", () => {
  const { unmount } = render(
    <QuestionHarness call={askCall("q1", questions)} onApprove={vi.fn()} />,
  );
  fireEvent.click(radio(/JSON file/));
  click("Next");
  fireEvent.change(box(), { target: { value: "Windows" } });
  unmount();
  const onApprove = show();
  expect(screen.getByText("2/2")).toBeTruthy();
  expect(box().value).toBe("Windows");
  click("Send answers");
  expect(onApprove.mock.calls[0][2][0].choices).toEqual(["JSON file"]);
  cleanup();
  show();
  expect(screen.getByText("1/2")).toBeTruthy();
});
