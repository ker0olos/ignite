import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommentSelection } from "@/hooks/useCommentSelection";

const up = () =>
  act(() => void window.dispatchEvent(new MouseEvent("mouseup")));

describe("useCommentSelection", () => {
  it("takes one row on a press, opening its box on release", () => {
    const { result } = renderHook(() => useCommentSelection());
    act(() => result.current.press(4, false));
    expect(result.current.selected(4)).toBe(true);
    expect(result.current.draft).toBeNull();
    up();
    expect(result.current.draft).toEqual({ from: 4, to: 4 });
  });

  it("takes the rows a drag covers, upward too", () => {
    const { result } = renderHook(() => useCommentSelection());
    act(() => result.current.press(6, false));
    act(() => result.current.hover(2));
    expect(result.current.selected(3)).toBe(true);
    expect(result.current.selected(7)).toBe(false);
    up();
    expect(result.current.draft).toEqual({ from: 2, to: 6 });
  });

  it("ignores the pointer when nothing is pressed", () => {
    const { result } = renderHook(() => useCommentSelection());
    act(() => result.current.hover(2));
    up();
    expect(result.current.draft).toBeNull();
    expect(result.current.selected(2)).toBe(false);
  });

  it("takes a range from the last pressed row on shift-press", () => {
    const { result } = renderHook(() => useCommentSelection());
    act(() => result.current.press(8, true));
    expect(result.current.draft).toBeNull();
    act(() => result.current.open(5));
    act(() => result.current.press(1, true));
    expect(result.current.draft).toEqual({ from: 1, to: 5 });
  });

  it("opens a saved comment for editing without selecting rows, and closes", () => {
    const { result } = renderHook(() => useCommentSelection());
    act(() => result.current.edit({ from: 1, to: 3, id: 9 }));
    expect(result.current.draft).toEqual({ from: 1, to: 3, id: 9 });
    expect(result.current.selected(2)).toBe(false);
    act(() => result.current.close());
    expect(result.current.draft).toBeNull();
  });
});
