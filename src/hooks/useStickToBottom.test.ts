import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStickToBottom } from "./useStickToBottom";
import type { Item } from "@/lib/transcript";

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

function setup() {
  const el = document.createElement("main");
  let height = 1000;
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => top,
    set: (v: number) => (top = Math.min(v, height - 200)),
  });
  Object.defineProperty(el, "scrollHeight", { get: () => height });
  Object.defineProperty(el, "clientHeight", { get: () => 200 });
  const scroll = (top: number) => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  };
  const grow = (by: number) => {
    height += by;
    resized();
  };
  const content = document.createElement("div");
  const { result, rerender } = renderHook(
    ({ last }: { last: Item | undefined }) =>
      useStickToBottom({ current: el }, { current: content }, last),
    { initialProps: { last: undefined as Item | undefined } },
  );
  const shrink = (by: number) => {
    height -= by;
    scroll(top);
  };
  const send = () =>
    rerender({
      last: {
        kind: "message",
        message: { role: "user", content: "hi", timestamp: 0 },
      },
    });
  return { el, scroll, grow, shrink, send, stuck: result.current };
}

describe("useStickToBottom", () => {
  it("starts at the bottom and follows growth", () => {
    const { el, grow } = setup();
    expect(el.scrollTop).toBe(800);
    grow(50);
    expect(el.scrollTop).toBe(850);
  });

  it("stops following when the user scrolls up, even a little", () => {
    const { el, scroll, grow, stuck } = setup();
    scroll(790);
    expect(stuck.current).toBe(false);
    grow(50);
    expect(el.scrollTop).toBe(790);
  });

  it("keeps following through the bounce and subpixel moves at the bottom", () => {
    const { el, scroll, grow, stuck } = setup();
    scroll(799.5);
    expect(stuck.current).toBe(true);
    grow(50);
    expect(el.scrollTop).toBe(850);
  });

  it("resumes when the user scrolls back down to the bottom", () => {
    const { el, scroll, grow, stuck } = setup();
    scroll(500);
    scroll(790);
    expect(stuck.current).toBe(true);
    grow(50);
    expect(el.scrollTop).toBe(850);
  });

  it("follows again once the user sends a message", () => {
    const { el, scroll, grow, send } = setup();
    scroll(300);
    send();
    grow(50);
    expect(el.scrollTop).toBe(850);
  });

  it("keeps following when content shrinks and clamps the scroll", () => {
    const { el, shrink, grow, stuck } = setup();
    shrink(100);
    expect(el.scrollTop).toBe(700);
    expect(stuck.current).toBe(true);
    grow(50);
    expect(el.scrollTop).toBe(750);
  });
});
