import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmoothText } from "./useSmoothText";

let frames: FrameRequestCallback[] = [];
let now = 0;

function frame(ms = 16) {
  now += ms;
  const pending = frames;
  frames = [];
  act(() => pending.forEach((f) => f(now)));
}

beforeEach(() => {
  frames = [];
  now = 1000;
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) =>
    frames.push(f),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = () => {};
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("useSmoothText", () => {
  it("shows text present at mount at once, without animating", () => {
    const { result } = renderHook(() => useSmoothText("hello"));
    expect(result.current).toBe("hello");
    expect(frames).toHaveLength(0);
  });

  it("reveals new text over several frames, then stops", () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t), {
      initialProps: { t: "" },
    });
    rerender({ t: "x".repeat(100) });
    expect(result.current).toBe("");
    frame();
    frame();
    const partial = result.current.length;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(100);
    for (let i = 0; i < 100 && frames.length; i++) frame();
    expect(result.current).toHaveLength(100);
    expect(frames).toHaveLength(0);
  });

  it("shows shorter replacement text at once", () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t), {
      initialProps: { t: "long text" },
    });
    rerender({ t: "short" });
    expect(result.current).toBe("short");
  });
});
