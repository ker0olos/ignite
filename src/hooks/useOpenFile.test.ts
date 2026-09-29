import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOpenFile } from "./useOpenFile";

describe("useOpenFile", () => {
  it("opens a file of the current folder at once", () => {
    const openTab = vi.fn();
    const select = vi.fn();
    const { result } = renderHook(() => useOpenFile("/work", openTab, select));
    act(() => result.current("/work", "src/a.ts"));
    expect(openTab).toHaveBeenCalledWith("/work/src/a.ts");
    expect(select).not.toHaveBeenCalled();
  });

  it("selects another folder first, then opens the file once it's shown", () => {
    const openTab = vi.fn();
    const select = vi.fn();
    const { result, rerender } = renderHook(
      ({ current }) => useOpenFile(current, openTab, select),
      { initialProps: { current: "/work" } },
    );
    act(() => result.current("/other", "src/b.ts"));
    expect(select).toHaveBeenCalledWith("/other");
    expect(openTab).not.toHaveBeenCalled();

    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledWith("/other/src/b.ts");
    expect(openTab).toHaveBeenCalledTimes(1);
  });

  it("clears the pending file after opening it, so returning to the folder doesn't reopen it", () => {
    const openTab = vi.fn();
    const select = vi.fn();
    const { result, rerender } = renderHook(
      ({ current }) => useOpenFile(current, openTab, select),
      { initialProps: { current: "/work" } },
    );
    act(() => result.current("/other", "src/b.ts"));
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledTimes(1);
    rerender({ current: "/third" });
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledTimes(1);
  });

  it("waits for a folder to become current before opening the pending file", () => {
    const openTab = vi.fn();
    const select = vi.fn();
    const initial: { current: string | null } = { current: null };
    const { result, rerender } = renderHook(
      ({ current }) => useOpenFile(current, openTab, select),
      { initialProps: initial },
    );
    act(() => result.current("/other", "src/b.ts"));
    expect(select).toHaveBeenCalledWith("/other");
    rerender({ current: null });
    expect(openTab).not.toHaveBeenCalled();
    rerender({ current: "/other" });
    expect(openTab).toHaveBeenCalledWith("/other/src/b.ts");
  });
});
