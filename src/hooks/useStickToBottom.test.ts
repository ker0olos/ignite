import { renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
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
  let width = 800;
  Object.defineProperty(el, "clientWidth", { get: () => width });
  const scroll = (top: number) => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  };
  const grow = (by: number) => {
    height += by;
    resized();
  };
  const scrollRef = { current: el };
  const contentRef = { current: document.createElement("div") };
  let props = { last: undefined as Item | undefined, shown: true };
  const { result, rerender } = renderHook(
    ({ last, shown }: typeof props) =>
      useStickToBottom(scrollRef, contentRef, last, shown),
    { initialProps: props },
  );
  const show = (shown: boolean) => rerender((props = { ...props, shown }));
  const shrink = (by: number) => {
    height -= by;
    scroll(top);
  };
  const send = () =>
    rerender(
      (props = {
        ...props,
        last: {
          kind: "message",
          message: { role: "user", content: "hi", timestamp: 0 },
        },
      }),
    );
  const narrow = (to: number, by: number) => {
    width = to;
    grow(by);
  };
  // Reflowed and clamped, its scroll event arriving before the ResizeObserver.
  const widen = (to: number, by: number) => {
    width = to;
    height -= by;
    scroll(top);
  };
  return {
    el,
    scroll,
    grow,
    shrink,
    send,
    narrow,
    widen,
    show,
    stuck: result.current,
  };
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

  it("keeps the place in view when narrowing reflows the text", () => {
    const { el, scroll, narrow } = setup();
    scroll(400); // middle at 500 of 1000
    narrow(400, 1000);
    expect(el.scrollTop).toBe(900); // middle at 1000 of 2000
  });

  it("keeps the place when widening clamps the scroll to the bottom first", () => {
    const { el, scroll, narrow, widen, stuck } = setup();
    narrow(400, 1000);
    scroll(1500); // middle at 1600 of 2000
    widen(800, 1000); // clamped to 800, the bottom
    expect(el.scrollTop).toBe(700); // middle at 800 of 1000
    expect(stuck.current).toBe(false);
  });

  it("leaves the place alone when content grows at the same width", () => {
    const { el, scroll, grow } = setup();
    scroll(400);
    grow(1000);
    expect(el.scrollTop).toBe(400);
  });

  it("keeps following when content shrinks and clamps the scroll", () => {
    const { el, shrink, grow, stuck } = setup();
    shrink(100);
    expect(el.scrollTop).toBe(700);
    expect(stuck.current).toBe(true);
    grow(50);
    expect(el.scrollTop).toBe(750);
  });

  it("puts back the bottom when shown after its scroll was reset while hidden", () => {
    const { el, scroll, grow, show, stuck } = setup();
    show(false);
    scroll(0);
    grow(50);
    show(true);
    expect(el.scrollTop).toBe(850);
    expect(stuck.current).toBe(true);
  });

  it("puts back the place the user left when shown after a reset while hidden", () => {
    const { el, scroll, grow, show, stuck } = setup();
    scroll(400);
    show(false);
    el.scrollTop = 0;
    show(true);
    expect(el.scrollTop).toBe(400);
    el.scrollTop = 0;
    show(false);
    grow(500);
    expect(el.scrollTop).toBe(400);
    show(true);
    expect(el.scrollTop).toBe(400);
    expect(stuck.current).toBe(false);
  });

  it("is at the bottom before the first paint, not after it", () => {
    const el = document.createElement("main");
    let top = 0;
    Object.defineProperty(el, "scrollTop", {
      get: () => top,
      set: (v: number) => (top = Math.min(v, 800)),
    });
    Object.defineProperty(el, "scrollHeight", { get: () => 1000 });
    Object.defineProperty(el, "clientHeight", { get: () => 200 });
    Object.defineProperty(el, "clientWidth", { get: () => 800 });
    const scrollRef = { current: el };
    const contentRef = { current: document.createElement("div") };
    let painted: number | undefined;
    renderHook(() => {
      useStickToBottom(scrollRef, contentRef, undefined, true);
      useLayoutEffect(() => {
        painted ??= el.scrollTop;
      });
    });
    expect(painted).toBe(800);
  });
});
