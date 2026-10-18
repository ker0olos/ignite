import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CommentableLines } from "@/components/files/CommentableLines";
import { useDiffComments } from "@/hooks/useDiffComments";
import { DEFAULT_CODE_THEMES } from "@/lib/codeThemes";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { DiffLine } from "@/lib/toolRows";

const lines: DiffLine[] = [
  { kind: "ctx", num: 1, text: "one" },
  { kind: "del", num: 2, text: "two" },
  { kind: "add", num: 2, text: "deux" },
];

function Lines() {
  const comments = useDiffComments(
    { repo: "/repo", range: "HEAD", path: "a.ts", status: "M", session: "v1" },
    { shown: "v1", show: vi.fn() },
  );
  return (
    <CommentableLines
      lines={lines}
      path="a.ts"
      comments={comments}
      editor={DEFAULT_SETTINGS.editor}
      themes={DEFAULT_CODE_THEMES}
    />
  );
}

it("comments on a dragged range, then edits and deletes the comment", () => {
  render(<Lines />);
  const plus = screen.getAllByRole("button", { name: "Comment on this line" });
  fireEvent.mouseDown(plus[0]);
  fireEvent.mouseMove(screen.getByText("deux"));
  act(() => void window.dispatchEvent(new MouseEvent("mouseup")));

  const box = screen.getByRole("textbox", { name: "Comment" });
  expect(document.activeElement).toBe(box);
  fireEvent.change(box, { target: { value: "Rename it" } });
  fireEvent.keyDown(box, { key: "Enter", metaKey: true });
  expect(screen.getByText("Rename it")).toBeTruthy();
  expect(screen.getByText("a.ts:1-2")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Edit comment" }));
  const edit = screen.getByRole("textbox", { name: "Comment" });
  fireEvent.change(edit, { target: { value: "Rename it again" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Rename it again")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
  expect(screen.queryByText("Rename it again")).toBeNull();
});

it("opens one row's box from the keyboard and cancels with Esc", () => {
  render(<Lines />);
  const plus = screen.getAllByRole("button", { name: "Comment on this line" });
  fireEvent.click(plus[1], { detail: 0 });
  const box = screen.getByRole("textbox", { name: "Comment" });
  fireEvent.keyDown(box, { key: "Escape" });
  expect(screen.queryByRole("textbox", { name: "Comment" })).toBeNull();
});
