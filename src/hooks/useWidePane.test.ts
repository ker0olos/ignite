import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWidePane } from "./useWidePane";

let resized: () => void = () => {};
const disconnect = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class {
    constructor(callback: () => void) {
      resized = callback;
    }
    observe() {}
    disconnect = disconnect;
  },
);

afterEach(() => disconnect.mockClear());

it("follows whether the element is at least as wide as asked", () => {
  const el = document.createElement("div");
  let width = 900;
  Object.defineProperty(el, "clientWidth", { get: () => width });
  const { result, unmount } = renderHook(() =>
    useWidePane({ current: el }, 860),
  );
  expect(result.current).toBe(true);
  width = 600;
  act(() => resized());
  expect(result.current).toBe(false);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("is narrow without an element", () => {
  const { result } = renderHook(() => useWidePane({ current: null }, 860));
  expect(result.current).toBe(false);
});
