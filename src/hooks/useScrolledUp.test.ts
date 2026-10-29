import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrolledUp } from "./useScrolledUp";

let resized: () => void = () => {};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resized = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function scroller(scrollTop: number) {
  const el = document.createElement("div");
  let height = 3000;
  Object.defineProperty(el, "scrollHeight", { get: () => height });
  Object.defineProperty(el, "clientHeight", { value: 500 });
  el.scrollTop = scrollTop;
  return { el, grow: (by: number) => (height += by) };
}

const content = { current: document.createElement("div") };

describe("useScrolledUp", () => {
  it("is false within a screen of the bottom", () => {
    const { el } = scroller(2100);
    const { result } = renderHook(() =>
      useScrolledUp({ current: el }, content),
    );
    expect(result.current).toBe(false);
  });

  it("turns true once scrolled further up, and false again at the bottom", () => {
    const { el } = scroller(2500);
    const { result } = renderHook(() =>
      useScrolledUp({ current: el }, content),
    );
    expect(result.current).toBe(false);
    act(() => {
      el.scrollTop = 1000;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(true);
    act(() => {
      el.scrollTop = 2500;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(false);
  });

  it("turns true as the content grows below, with no scroll", () => {
    const { el, grow } = scroller(2300);
    const { result } = renderHook(() =>
      useScrolledUp({ current: el }, content),
    );
    expect(result.current).toBe(false);
    act(() => {
      grow(1000);
      resized();
    });
    expect(result.current).toBe(true);
  });

  it("stays false with nothing to scroll", () => {
    const { result } = renderHook(() =>
      useScrolledUp({ current: null }, content),
    );
    expect(result.current).toBe(false);
  });
});
