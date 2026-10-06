import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EndRow } from "./EndRow";
import { ContinueContext } from "./shared";

const end = (errorMessage: string) =>
  ({ role: "assistant", stopReason: "error", errorMessage }) as Parameters<
    typeof EndRow
  >[0]["message"];

it("shows a short error as is, and continues from the last one", () => {
  const onContinue = vi.fn();
  render(
    <ContinueContext.Provider value={onContinue}>
      <EndRow message={end("Rate limited.")} last />
    </ContinueContext.Provider>,
  );
  expect(screen.getByText("Rate limited.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalled();
});

it("keeps a long error under Details", () => {
  render(<EndRow message={end("prompt-capture: ".padEnd(300, "x"))} last />);
  expect(screen.getByText("The run stopped on an error.")).toBeTruthy();
  expect(screen.getByText("Details")).toBeTruthy();
});

it("offers Continue only on the last row, and not while a run goes", () => {
  const { rerender } = render(
    <ContinueContext.Provider value={vi.fn()}>
      <EndRow message={end("Failed.")} last={false} />
    </ContinueContext.Provider>,
  );
  expect(screen.queryByRole("button")).toBe(null);
  rerender(
    <ContinueContext.Provider value={null}>
      <EndRow message={end("Failed.")} last />
    </ContinueContext.Provider>,
  );
  expect(screen.queryByRole("button")).toBe(null);
});

it("says Stopped for a run the user stopped", () => {
  render(
    <EndRow message={{ ...end(""), stopReason: "aborted" } as never} last />,
  );
  expect(screen.getByText("Stopped")).toBeTruthy();
});
