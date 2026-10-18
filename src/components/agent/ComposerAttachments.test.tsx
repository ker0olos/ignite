import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SentFile } from "../../../shared/attachedFiles";
import { ComposerAttachments } from "@/components/agent/ComposerAttachments";
import { OpenTabContext } from "@/hooks/useOpenTab";
import { revealedComment } from "@/lib/diffComments";
import { readDiffTab } from "@/lib/diffTabs";
import type { DiffComment } from "@/lib/diffComments";

const comment: DiffComment = {
  id: 7,
  diff: { repo: "/repo", range: "HEAD", status: "M" },
  path: "src/a.ts",
  from: 0,
  to: 0,
  lines: [{ kind: "add", num: 3, text: "x" }],
  text: "Rename it",
};
const image = { type: "image" as const, data: "QQ==", mimeType: "image/png" };

const file: SentFile = { path: "/d/report.pdf" };

const show = (images = [image], comments = [comment], files = [file]) => {
  const props = {
    onRemoveImage: vi.fn(),
    onEditImage: vi.fn(),
    onRemoveFile: vi.fn(),
    onRemoveComment: vi.fn(),
  };
  const attached = {
    files,
    removeFile: props.onRemoveFile,
    comments,
    removeComment: props.onRemoveComment,
  };
  const view = render(
    <ComposerAttachments
      images={images}
      onRemoveImage={props.onRemoveImage}
      onEditImage={props.onEditImage}
      attached={attached}
    />,
  );
  return { ...props, view };
};

it("shows images and comments in one strip, each removable", () => {
  const { onRemoveImage, onRemoveComment } = show();
  expect(screen.getByText("a.ts:3")).toBeTruthy();
  expect(screen.getByText("Rename it")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove comment" }));
  expect(onRemoveImage).toHaveBeenCalledWith(0);
  expect(onRemoveComment).toHaveBeenCalledWith(7);
});

it("shows nothing with nothing attached", () => {
  const { view } = show([], [], []);
  expect(view.container.innerHTML).toBe("");
});

it("opens the comment's own diff tab and reveals it there, but not one with no diff", () => {
  const openTab = vi.fn();
  const props = {
    images: [],
    onRemoveImage: vi.fn(),
    onEditImage: vi.fn(),
  };
  const attached = (comments: DiffComment[]) => ({
    files: [],
    removeFile: vi.fn(),
    comments,
    removeComment: vi.fn(),
  });
  const opened = { ...comment, diff: { ...comment.diff!, session: "s1" } };
  const { rerender } = render(
    <OpenTabContext.Provider value={openTab}>
      <ComposerAttachments {...props} attached={attached([opened])} />
    </OpenTabContext.Provider>,
  );
  fireEvent.click(screen.getByText("Rename it"));
  expect(readDiffTab(openTab.mock.calls[0][0])).toEqual({
    repo: "/repo",
    range: "HEAD",
    status: "M",
    path: "src/a.ts",
    session: "s1",
  });
  expect(revealedComment()).toBe(7);

  rerender(
    <OpenTabContext.Provider value={openTab}>
      <ComposerAttachments
        {...props}
        attached={attached([{ ...comment, id: 8, diff: undefined }])}
      />
    </OpenTabContext.Provider>,
  );
  fireEvent.click(screen.getByText("Rename it"));
  expect(openTab).toHaveBeenCalledTimes(1);
});

it("shows a dropped file by name, and removes it", () => {
  const { onRemoveFile } = show(
    [],
    [],
    [file, { path: "/d/a.txt", text: "x" }],
  );
  expect(screen.getByText("report.pdf")).toBeTruthy();
  expect(screen.getByText("a.txt")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Remove file" })[1]);
  expect(onRemoveFile).toHaveBeenCalledWith(1);
});
