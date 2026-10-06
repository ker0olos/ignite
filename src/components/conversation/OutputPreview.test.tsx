import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OutputPreview } from "./OutputPreview";

it("collapses a long error like any output, and opens it on click", () => {
  render(<OutputPreview text={"184: one\n185: two\n186: three"} error />);
  expect(screen.queryByText(/185: two/)).toBe(null);
  fireEvent.click(screen.getByRole("button", { name: "3 lines of output" }));
  expect(screen.getByText(/185: two/)).toBeTruthy();
});

it("shows a short error as is", () => {
  render(<OutputPreview text="Not run: the app reloaded." error />);
  expect(screen.getByText("Not run: the app reloaded.")).toBeTruthy();
});

it("says output is still coming while its command runs", () => {
  render(<OutputPreview text={"one\ntwo\nthree"} running />);
  fireEvent.click(
    screen.getByRole("button", { name: /Running… 3 lines of output so far/ }),
  );
  expect(screen.getByText(/two/)).toBeTruthy();
});
