import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OutputViews } from "./OutputViews";

const two = [
  { id: 1, name: "ada" },
  { id: 2, name: "bob" },
];

it("opens many records on a table and switches views", () => {
  render(<OutputViews text="RAW TEXT" records={two} />);
  expect(screen.getByText("name")).toBeTruthy();
  expect(screen.getByText("ada")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Fields" }));
  expect(screen.getByText("Row 1 of 2")).toBeTruthy();
  expect(screen.getByText("ada")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next row" }));
  expect(screen.getByText("Row 2 of 2")).toBeTruthy();
  expect(screen.getByText("bob")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Raw" }));
  expect(screen.getByText("RAW TEXT")).toBeTruthy();
});

it("opens one record on its fields with no pager", () => {
  render(<OutputViews text="" records={[two[0]]} />);
  expect(screen.getByText("Row 1 of 1")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next row" })).toBe(null);
});

it("cuts a long table and shows the rest on click", () => {
  const records = Array.from({ length: 12 }, (_, i) => ({ id: 1000 + i }));
  render(<OutputViews text="" records={records} />);
  expect(screen.queryByText("1011")).toBe(null);
  fireEvent.click(screen.getByRole("button", { name: "… +2 rows" }));
  expect(screen.getByText("1011")).toBeTruthy();
});

it("shows the last record when the output shrinks below the one picked", () => {
  const three = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const { rerender } = render(<OutputViews text="" records={three} />);
  fireEvent.click(screen.getByRole("tab", { name: "Fields" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous row" }));
  expect(screen.getByText("Row 3 of 3")).toBeTruthy();
  rerender(<OutputViews text="" records={three.slice(0, 2)} />);
  expect(screen.getByText("Row 2 of 2")).toBeTruthy();
});
