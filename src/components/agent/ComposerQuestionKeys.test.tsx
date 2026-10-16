import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { askCall } from "@/test/askCall";
import { QuestionHarness } from "@/test/QuestionHarness";

const questions = [
  {
    question: "Where should settings live?",
    options: [{ label: "SQLite" }, { label: "JSON file" }],
  },
  {
    question: "Which platforms?",
    options: [{ label: "macOS" }, { label: "Linux" }],
    multiSelect: true,
  },
];

const show = () => {
  const onApprove = vi.fn();
  render(
    <QuestionHarness call={askCall("q1", questions)} onApprove={onApprove} />,
  );
  return onApprove;
};
const sqlite = () => screen.getByRole("radio", { name: "SQLite" });
const json = () => screen.getByRole("radio", { name: "JSON file" });
const box = () => screen.getByLabelText<HTMLTextAreaElement>("Composer");

it("leaves focus where it is when a question shows", () => {
  const outside = document.createElement("textarea");
  document.body.append(outside);
  outside.focus();
  show();
  expect(document.activeElement).toBe(outside);
  outside.remove();
});

it("moves between the options and the text with the arrow keys", () => {
  show();
  act(() => sqlite().focus());
  expect(sqlite().textContent).toContain("Space");
  expect(json().textContent).toContain("↓");
  fireEvent.keyDown(sqlite(), { key: "ArrowUp" });
  expect(document.activeElement).toBe(sqlite());
  fireEvent.keyDown(sqlite(), { key: "ArrowDown" });
  expect(document.activeElement).toBe(json());
  fireEvent.keyDown(json(), { key: "ArrowDown", shiftKey: true });
  expect(document.activeElement).toBe(json());
  fireEvent.keyDown(json(), { key: "ArrowDown" });
  expect(document.activeElement).toBe(box());
});

it("goes up from the text to the last option only at its start", () => {
  show();
  fireEvent.change(box(), { target: { value: "Postgres" } });
  box().focus();
  box().setSelectionRange(3, 3);
  fireEvent.keyDown(box(), { key: "ArrowUp" });
  expect(document.activeElement).toBe(box());
  box().setSelectionRange(0, 0);
  fireEvent.keyDown(box(), { key: "ArrowUp" });
  expect(document.activeElement).toBe(json());
});

it("goes on with Enter on an option or in the text", () => {
  show();
  fireEvent.keyDown(sqlite(), { key: "Enter" });
  expect(screen.getByText("2/2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.keyDown(box(), { key: "Enter" });
  expect(screen.getByText("2/2")).toBeTruthy();
});

it("types on an option into the text", () => {
  show();
  fireEvent.keyDown(json(), { key: "k" });
  expect(box().value).toBe("k");
  expect(document.activeElement).toBe(box());
});

it("goes on and leaves the questions to the agent from the window", () => {
  const onApprove = show();
  fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
  expect(screen.getByText("2/2")).toBeTruthy();
  fireEvent.keyDown(window, { key: "Backspace", ctrlKey: true });
  expect(onApprove).toHaveBeenCalledWith("q1", false);
});

it("keeps Ctrl+Backspace for a text box with text", () => {
  const onApprove = show();
  fireEvent.change(box(), { target: { value: "draft" } });
  box().focus();
  fireEvent.keyDown(box(), { key: "Backspace", ctrlKey: true });
  expect(onApprove).not.toHaveBeenCalled();
  fireEvent.change(box(), { target: { value: "" } });
  fireEvent.keyDown(box(), { key: "Backspace", ctrlKey: true });
  expect(onApprove).toHaveBeenCalledWith("q1", false);
});

it("goes to the text with Ctrl+N", () => {
  show();
  fireEvent.keyDown(window, { key: "n", ctrlKey: true });
  expect(document.activeElement).toBe(box());
});

it("picks options with Alt and a digit, even while typing", () => {
  show();
  expect(json().textContent).toContain("Alt+2");
  box().focus();
  fireEvent.keyDown(box(), { key: "™", code: "Digit2", altKey: true });
  expect(json().getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(window, { code: "Digit9", altKey: true });
  expect(document.activeElement).toBe(box());
});

it("leaves the keys to a field outside the composer", () => {
  const onApprove = show();
  const outside = document.createElement("textarea");
  document.body.append(outside);
  outside.focus();
  fireEvent.keyDown(outside, { key: "Enter", ctrlKey: true });
  fireEvent.keyDown(outside, { code: "Digit1", altKey: true });
  fireEvent.keyDown(outside, { key: "n", ctrlKey: true });
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(sqlite().getAttribute("aria-checked")).toBe("false");
  expect(document.activeElement).toBe(outside);
  expect(onApprove).not.toHaveBeenCalled();
  outside.remove();
});
