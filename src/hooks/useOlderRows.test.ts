import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROWS_STEP, useOlderRows } from "./useOlderRows";

let near: ((entries: { isIntersecting: boolean }[]) => void) | null;

beforeEach(() => {
  near = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: typeof near) {
        near = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
});

const scroll = () => {
  const el = document.createElement("main");
  let height = 1000;
  Object.defineProperty(el, "scrollHeight", { get: () => height });
  return { ref: { current: el }, grow: (by: number) => (height += by) };
};

/** The hook with its top marker mounted, as Conversation renders it. */
const render = (total: number, shown = true) => {
  const { ref, grow } = scroll();
  const hook = renderHook(
    ({ total, shown }) => {
      const r = useOlderRows(ref, total, shown);
      r.topRef.current ??= document.createElement("div");
      return r;
    },
    { initialProps: { total, shown } },
  );
  return { ref, grow, ...hook };
};

describe("useOlderRows", () => {
  it("draws the newest rows, older ones as the top nears, holding the scroll", () => {
    const { ref, grow, result, rerender } = render(100);
    expect(result.current.start).toBe(100 - ROWS_STEP);
    rerender({ total: 100, shown: true });
    ref.current.scrollTop = 0;
    act(() => {
      near!([{ isIntersecting: true }]);
      grow(500);
    });
    expect(result.current.start).toBe(100 - 2 * ROWS_STEP);
    expect(ref.current.scrollTop).toBe(500);
    act(() => near!([{ isIntersecting: false }]));
    expect(result.current.start).toBe(100 - 2 * ROWS_STEP);
  });

  it("keeps its start as rows are added, and draws a short conversation whole", () => {
    const { result, rerender } = render(50);
    expect(result.current.start).toBe(10);
    rerender({ total: 60, shown: true });
    expect(result.current.start).toBe(10);
    expect(render(5).result.current.start).toBe(0);
  });

  it("loads nothing older while hidden", () => {
    const { rerender } = render(100, false);
    rerender({ total: 100, shown: false });
    expect(near).toBeNull();
  });
});
