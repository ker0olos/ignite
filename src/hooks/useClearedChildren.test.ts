import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClearedChildren } from "./useClearedChildren";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useClearedChildren", () => {
  it("remembers what was cleared across a reload, once each", () => {
    const first = renderHook(() => useClearedChildren());
    act(() => first.result.current.clear("a"));
    act(() => first.result.current.clear("b"));
    act(() => first.result.current.clear("a"));
    expect(first.result.current.cleared).toEqual(["b", "a"]);
    const again = renderHook(() => useClearedChildren());
    expect(again.result.current.cleared).toEqual(["b", "a"]);
  });

  it("keeps only the latest 200", () => {
    const { result } = renderHook(() => useClearedChildren());
    act(() => {
      for (let i = 0; i < 205; i++) result.current.clear(`t${i}`);
    });
    expect(result.current.cleared).toHaveLength(200);
    expect(result.current.cleared[0]).toBe("t5");
  });

  it("starts empty from missing or bad storage, and still clears when saving fails", () => {
    localStorage.setItem("cleared-children", "{bad");
    expect(
      renderHook(() => useClearedChildren()).result.current.cleared,
    ).toEqual([]);
    localStorage.setItem("cleared-children", '{"a":1}');
    expect(
      renderHook(() => useClearedChildren()).result.current.cleared,
    ).toEqual([]);
    localStorage.setItem("cleared-children", '["a", 2]');
    const { result } = renderHook(() => useClearedChildren());
    expect(result.current.cleared).toEqual(["a"]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    act(() => result.current.clear("b"));
    expect(result.current.cleared).toEqual(["a", "b"]);
  });
});
