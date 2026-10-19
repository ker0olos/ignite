import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { useTabs } from "./useTabs";

// Ordering rules (which tab activates on close) are tested in lib/tabs.test.ts;
// these cover the hook: state updates and keeping each conversation's tabs.

describe("useTabs", () => {
  it("starts with no tabs", () => {
    const { result } = renderHook(() => useTabs("/repo", "s1"));
    expect(result.current.files).toEqual([]);
    expect(result.current.active).toBeNull();
  });

  it("opens, activates and closes tabs", () => {
    const { result } = renderHook(() => useTabs("/repo", "s1"));
    act(() => result.current.open("/repo/a"));
    act(() => result.current.open("/repo/b"));
    expect(result.current.files).toEqual(["/repo/a", "/repo/b"]);
    expect(result.current.active).toBe("/repo/b");

    act(() => result.current.activate("/repo/a"));
    expect(result.current.active).toBe("/repo/a");

    act(() => result.current.close("/repo/a"));
    expect(result.current.files).toEqual(["/repo/b"]);
    expect(result.current.active).toBe("/repo/b");
  });

  it("moves a tab under the conversation and back", () => {
    const { result } = renderHook(() => useTabs("/repo", "s1"));
    act(() => result.current.open("/repo/a"));
    act(() => result.current.open("/repo/b"));
    act(() => result.current.move("/repo/a", "bottom", 0));
    expect(result.current.side.files).toEqual(["/repo/b"]);
    expect(result.current.bottom).toEqual({
      files: ["/repo/a"],
      active: "/repo/a",
    });
    expect(result.current.files).toEqual(["/repo/b", "/repo/a"]);
    expect(result.current.active).toBe("/repo/a");

    act(() => result.current.move("/repo/a", "side", 0));
    expect(result.current.side.files).toEqual(["/repo/a", "/repo/b"]);
    expect(result.current.bottom.files).toEqual([]);
  });

  it("shows none for a folder that has none", () => {
    const { result, rerender } = renderHook(
      ({ folder, session }) => useTabs(folder, session),
      { initialProps: { folder: "/repo" as string | null, session: "s1" } },
    );
    act(() => result.current.open("/repo/a"));
    rerender({ folder: "/other", session: "s2" });
    expect(result.current.files).toEqual([]);
    expect(result.current.active).toBeNull();
  });

  it("brings a conversation's tabs back when it shows again", () => {
    const { result, rerender } = renderHook(
      ({ folder, session }) => useTabs(folder, session),
      { initialProps: { folder: "/repo" as string | null, session: "s1" } },
    );
    act(() => result.current.open("/repo/a"));
    rerender({ folder: "/other", session: "s2" });
    act(() => result.current.open("/other/x"));
    rerender({ folder: "/repo", session: "s1" });
    expect(result.current.files).toEqual(["/repo/a"]);
    expect(result.current.active).toBe("/repo/a");
  });

  it("has no tabs, and opens none, when no folder is open", () => {
    const { result, rerender } = renderHook(
      ({ folder, session }) => useTabs(folder, session),
      { initialProps: { folder: "/repo" as string | null, session: "s1" } },
    );
    act(() => result.current.open("/repo/a"));
    rerender({ folder: null, session: "s1" });
    expect(result.current.files).toEqual([]);
    act(() => result.current.open("/x"));
    expect(result.current.files).toEqual([]);
  });

  it("keeps each conversation's tabs, and drops a closed one's", () => {
    const { result, rerender } = renderHook(
      ({ session }) => useTabs("/repo", session),
      { initialProps: { session: "a" as string | null } },
    );
    act(() => result.current.open("/wt/a/x"));
    rerender({ session: "b" });
    expect(result.current.files).toEqual([]);
    act(() => result.current.open("/wt/b/y"));
    expect(result.current.isOpen("/wt/a/x")).toBe(true);
    expect(result.current.isOpen("/wt/b/y")).toBe(true);
    act(() => result.current.closeEverywhere("/wt/a/x"));
    act(() => result.current.forget("/repo", "b"));
    expect(result.current.isOpen("/wt/a/x")).toBe(false);
    expect(result.current.isOpen("/wt/b/y")).toBe(false);
  });

  it("hands the tabs opened before the first message to the conversation it starts, in its worktree", async () => {
    fakeFs({ "/wt/new/a": "" });
    const { result, rerender } = renderHook(
      ({ session }) => useTabs("/repo", session),
      { initialProps: { session: null as string | null } },
    );
    act(() => result.current.open("/repo/a"));
    act(() => result.current.open("/repo/untracked"));
    act(() => result.current.adopt("/repo", "new", "/wt/new"));
    rerender({ session: "new" });
    await waitFor(() =>
      expect(result.current.files).toEqual(["/wt/new/a", "/repo/untracked"]),
    );
    rerender({ session: null });
    expect(result.current.files).toEqual([]);
  });

  it("gives the tabs opened while the folder's conversation was unknown to the one it shows, its files in its worktree", async () => {
    fakeFs({ "/wt/s/a": "" });
    const { result, rerender } = renderHook(
      ({ session, root }) => useTabs("/repo", session, root),
      {
        initialProps: {
          session: undefined as string | null | undefined,
          root: "/repo",
        },
      },
    );
    act(() => result.current.open("child:term"));
    act(() => result.current.open("/repo/a"));
    act(() => result.current.open("/repo/untracked"));
    rerender({ session: "s", root: "/wt/s" });
    await waitFor(() =>
      expect(result.current.files).toEqual([
        "child:term",
        "/wt/s/a",
        "/repo/untracked",
      ]),
    );
  });

  it("lists every conversation's terminal tabs, the same array while they stay", () => {
    const { result, rerender } = renderHook(
      ({ session }) => useTabs("/repo", session),
      { initialProps: { session: "a" as string | null } },
    );
    const term = 'child:{"kind":"terminal","session":"","terminal":"t1"}';
    act(() => result.current.open(term));
    act(() => result.current.open("/wt/a/x"));
    const first = result.current.terminalTabs;
    expect(first).toEqual([term]);
    act(() => result.current.move("/wt/a/x", "bottom", 0));
    rerender({ session: "b" });
    expect(result.current.terminalTabs).toBe(first);
    expect(result.current.isOpen(term)).toBe(true);
    expect(result.current.isOpen("nope")).toBe(false);
  });
});
