import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { OutputPreview } from "./OutputPreview";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

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

it("shows a lone pull request link as a pill naming it", () => {
  render(
    <OutputPreview
      text={"https://github.com/lead-led/motr-server/pull/789\n"}
    />,
  );
  expect(screen.getByRole("button", { name: /motr-server#789/ })).toBeTruthy();
});

it("shows output still streaming as a terminal's text, markdown or not", () => {
  render(<OutputPreview text={"## What\n- **bold** item\n- two"} live />);
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
  expect(screen.queryByRole("heading")).toBe(null);
  expect(screen.getByText(/## What/)).toBeTruthy();
});

it("opens markdown as a page, and its raw text on Raw", () => {
  render(<OutputPreview text={"Intro\n\n## What\n- **bold** item\n- two"} />);
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
  expect(screen.getByRole("heading", { name: "What" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Raw" }));
  expect(screen.getByText(/## What/)).toBeTruthy();
});

it("shows a one-line JSON answer as text", () => {
  render(<OutputPreview text='{"ok":true}' />);
  expect(screen.queryByRole("tablist")).toBe(null);
  expect(screen.getByText(/"ok": true/)).toBeTruthy();
});
