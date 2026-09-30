import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFileSearchPalette } from "./useFileSearchPalette";

const press = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, cancelable: true, ...mods }),
    );
  });

describe("useFileSearchPalette", () => {
  it("opens on Cmd+P when a folder is shown", () => {
    const { result } = renderHook(() => useFileSearchPalette("/repo"));
    expect(result.current.open).toBe(false);
    press("p", { metaKey: true });
    expect(result.current.open).toBe(true);
  });

  it("also opens on Ctrl+P", () => {
    const { result } = renderHook(() => useFileSearchPalette("/repo"));
    press("P", { ctrlKey: true });
    expect(result.current.open).toBe(true);
  });

  it("does not open without a current folder", () => {
    const { result } = renderHook(() => useFileSearchPalette(null));
    press("p", { metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("ignores shifted and unrelated shortcuts", () => {
    const { result } = renderHook(() => useFileSearchPalette("/repo"));
    press("p", { metaKey: true, shiftKey: true });
    expect(result.current.open).toBe(false);
    press("k", { metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("bumps opening each time so the palette resets its query", () => {
    const { result } = renderHook(() => useFileSearchPalette("/repo"));
    const first = result.current.opening;
    act(() => result.current.openWithCurrentFolder());
    expect(result.current.opening).toBe(first + 1);
    act(() => result.current.setOpen(false));
    act(() => result.current.openWithCurrentFolder());
    expect(result.current.opening).toBe(first + 2);
  });
});
