import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { FileTree } from "./FileTree";

const tree = (root: string) =>
  render(
    <FileTree
      root={root}
      folder="/work"
      selected={null}
      onOpenFile={vi.fn()}
      hideGitIgnored={false}
    />,
  );

it("keeps a folder open in every worktree of the folder", async () => {
  fakeFs({ "/wt/a/src/x.ts": "", "/wt/b/src/x.ts": "" });
  tree("/wt/a");
  fireEvent.click(await screen.findByText("src"));
  expect(await screen.findByText("x.ts")).toBeTruthy();
  expect(localStorage.getItem("file-tree-open")).toContain('"/work/src"');
  cleanup();
  tree("/wt/b");
  expect(await screen.findByText("x.ts")).toBeTruthy();
});
