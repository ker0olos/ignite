import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
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

const show = (images = [image], comments = [comment]) => {
  const props = {
    onRemoveImage: vi.fn(),
    onEditImage: vi.fn(),
    onRemoveComment: vi.fn(),
  };
  const view = render(
    <ComposerAttachments
      images={images}
      comments={comments}
      session="s1"
      {...props}
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
  const { view } = show([], []);
  expect(view.container.innerHTML).toBe("");
});

it("opens a comment's diff tab and reveals it there, but not one with no diff", () => {
  const openTab = vi.fn();
  const props = {
    images: [],
    onRemoveImage: vi.fn(),
    onEditImage: vi.fn(),
    session: "s1",
    onRemoveComment: vi.fn(),
  };
  const { rerender } = render(
    <OpenTabContext.Provider value={openTab}>
      <ComposerAttachments {...props} comments={[comment]} />
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
        comments={[{ ...comment, id: 8, diff: undefined }]}
      />
    </OpenTabContext.Provider>,
  );
  fireEvent.click(screen.getByText("Rename it"));
  expect(openTab).toHaveBeenCalledTimes(1);
});
