import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OutputPreview } from "./OutputPreview";

it("collapses a long error like any output, and opens it on click", () => {
  render(<OutputPreview text={"184: one\n185: two\n186: three"} error />);
  expect(screen.queryByText(/185: two/)).toBe(null);
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
  expect(screen.getByText(/185: two/)).toBeTruthy();
});

it("shows a short error as is", () => {
  render(<OutputPreview text="Not run: the app reloaded." error />);
  expect(screen.getByText("Not run: the app reloaded.")).toBeTruthy();
});

it("keeps even short output under its label until opened", () => {
  render(<OutputPreview text="Merge made." label="Brought in 2 commits" />);
  expect(screen.queryByText("Merge made.")).toBe(null);
  fireEvent.click(screen.getByRole("button", { name: "Brought in 2 commits" }));
  expect(screen.getByText("Merge made.")).toBeTruthy();
});

const json = JSON.stringify(
  [
    { id: 1, name: "ada" },
    { id: 2, name: "bob" },
  ],
  null,
  1,
);

it("opens JSON records as a table", () => {
  render(<OutputPreview text={json} />);
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
  expect(screen.getByRole("table")).toBeTruthy();
});

it("shows JSON records in an error as plain text", () => {
  render(<OutputPreview text={json} error />);
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
  expect(screen.queryByRole("table")).toBe(null);
});

it("shows a one-line JSON answer as text", () => {
  render(<OutputPreview text='{"ok":true}' />);
  expect(screen.queryByRole("tablist")).toBe(null);
  expect(screen.getByText(/"ok": true/)).toBeTruthy();
});
