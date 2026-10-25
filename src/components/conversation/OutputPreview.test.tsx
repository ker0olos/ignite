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

it("starts open when asked, however long", () => {
  render(
    <OutputPreview text={"Script error:\nboom\nat line 3"} error defaultOpen />,
  );
  expect(screen.getByText(/boom/)).toBeTruthy();
});

it("keeps even short output under its label until opened", () => {
  render(<OutputPreview text="Merge made." label="Brought in 2 commits" />);
  expect(screen.queryByText("Merge made.")).toBe(null);
  fireEvent.click(screen.getByRole("button", { name: "Brought in 2 commits" }));
  expect(screen.getByText("Merge made.")).toBeTruthy();
});
