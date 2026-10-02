import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHiddenBelow } from "@/hooks/useHiddenBelow";

function list(bottom: number, rowBottoms: number[]) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ bottom }) as DOMRect;
  for (const b of rowBottoms) {
    const row = document.createElement("div");
    row.getBoundingClientRect = () => ({ bottom: b }) as DOMRect;
    el.appendChild(row);
  }
  return el;
}

describe("useHiddenBelow", () => {
  it("counts rows ending below the list, partly cut ones included", () => {
    const { result } = renderHook(() => useHiddenBelow<HTMLDivElement>([]));
    result.current.ref.current = list(100, [40, 80, 100.5, 120, 160]);
    act(() => result.current.update());
    expect(result.current.hidden).toBe(2);
  });

  it("is zero with nothing mounted", () => {
    const { result } = renderHook(() => useHiddenBelow<HTMLDivElement>([]));
    act(() => result.current.update());
    expect(result.current.hidden).toBe(0);
  });
});
