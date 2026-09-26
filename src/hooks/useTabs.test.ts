import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTabs } from "./useTabs";

// Ordering rules (which tab activates on close) are tested in lib/tabs.test.ts;
// these cover the hook: state updates and resetting per folder.

describe("useTabs", () => {
  it("starts with no tabs", () => {
    const { result } = renderHook(() => useTabs("/repo"));
    expect(result.current.files).toEqual([]);
    expect(result.current.active).toBeNull();
  });

  it("opens, activates and closes tabs", () => {
    const { result } = renderHook(() => useTabs("/repo"));
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

  it("drops the tabs when the folder changes", () => {
    const { result, rerender } = renderHook(({ folder }) => useTabs(folder), {
      initialProps: { folder: "/repo" as string | null },
    });
    act(() => result.current.open("/repo/a"));
    rerender({ folder: "/other" });
    expect(result.current.files).toEqual([]);
    expect(result.current.active).toBeNull();
  });

  it("does not bring old tabs back when returning to a folder", () => {
    const { result, rerender } = renderHook(({ folder }) => useTabs(folder), {
      initialProps: { folder: "/repo" as string | null },
    });
    act(() => result.current.open("/repo/a"));
    rerender({ folder: "/other" });
    act(() => result.current.open("/other/x"));
    rerender({ folder: "/repo" });
    expect(result.current.files).toEqual([]);
  });

  it("has no tabs when no folder is open", () => {
    const { result, rerender } = renderHook(({ folder }) => useTabs(folder), {
      initialProps: { folder: "/repo" as string | null },
    });
    act(() => result.current.open("/repo/a"));
    rerender({ folder: null });
    expect(result.current.files).toEqual([]);
  });
});
