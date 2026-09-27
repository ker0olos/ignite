import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RowBoundary } from "./RowBoundary";

function Row({ broken }: { broken: boolean }) {
  if (broken) throw new Error("bad row");
  return <p>fine</p>;
}

it("shows a failed row as a note and draws it again once it changes", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(
    <RowBoundary resetOn={1}>
      <Row broken />
    </RowBoundary>,
  );
  expect(screen.getByText(/couldn't be shown/)).toBeTruthy();
  rerender(
    <RowBoundary resetOn={1}>
      <Row broken={false} />
    </RowBoundary>,
  );
  expect(screen.getByText(/couldn't be shown/)).toBeTruthy();
  rerender(
    <RowBoundary resetOn={2}>
      <Row broken={false} />
    </RowBoundary>,
  );
  expect(screen.getByText("fine")).toBeTruthy();
});
