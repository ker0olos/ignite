import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTabDrag } from "./useTabDrag";

// A side strip with tabs a (x 0–100) and b (x 100–200); y 0–50 is in it, y > 50 is outside every dock.
let strip: HTMLElement;
let tabs: HTMLElement[];

beforeEach(() => {
  strip = document.createElement("div");
  strip.dataset.tabDock = "side";
  tabs = ["a", "b"].map((id, i) => {
    const tab = document.createElement("div");
    tab.dataset.tab = id;
    tab.setPointerCapture = vi.fn();
    tab.getBoundingClientRect = () =>
      ({ left: i * 100, width: 100 }) as DOMRect;
    strip.append(tab);
    return tab;
  });
  document.body.append(strip);
  document.elementFromPoint = (x: number, y: number) =>
    y > 50 ? document.body : x < 200 ? tabs[Math.floor(x / 100)] : strip;
});

afterEach(() => strip.remove());

const press = (start: ReturnType<typeof useTabDrag>["start"], x = 10) =>
  act(() =>
    start("a", {
      button: 0,
      currentTarget: tabs[0],
      pointerId: 1,
      clientX: x,
      clientY: 10,
    } as unknown as ReactPointerEvent),
  );

const fire = (type: string, x: number, y = 10) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }));
  });

function setup() {
  const onMove = vi.fn();
  const hook = renderHook(() => useTabDrag(onMove));
  return { onMove, hook, start: hook.result.current.start };
}

it("leaves a press that barely moves to the click", () => {
  const { onMove, hook, start } = setup();
  press(start);
  fire("pointermove", 12);
  expect(hook.result.current.drag).toBeNull();
  fire("pointerup", 12);
  expect(onMove).not.toHaveBeenCalled();
  expect(tabs[0].setPointerCapture).not.toHaveBeenCalled();
});

it("drops after a tab's middle, before it, or at the strip's end", () => {
  const { onMove, hook, start } = setup();
  press(start);
  fire("pointermove", 160);
  expect(hook.result.current.drag).toMatchObject({
    tab: "a",
    drop: { dock: "side", index: 2 },
  });
  expect(tabs[0].setPointerCapture).toHaveBeenCalledWith(1);
  fire("pointerup", 160);
  expect(onMove).toHaveBeenLastCalledWith("a", "side", 2);
  expect(hook.result.current.drag).toBeNull();

  press(start);
  fire("pointermove", 120);
  fire("pointerup", 120);
  expect(onMove).toHaveBeenLastCalledWith("a", "side", 1);

  press(start);
  fire("pointermove", 300);
  fire("pointerup", 300);
  expect(onMove).toHaveBeenLastCalledWith("a", "side", 2);
});

it("keeps its state while the pointer moves within one drop", () => {
  const { hook, start } = setup();
  press(start);
  fire("pointermove", 160);
  const first = hook.result.current.drag;
  fire("pointermove", 180);
  expect(hook.result.current.drag).toBe(first);
  fire("pointermove", 120);
  expect(hook.result.current.drag?.drop).toEqual({ dock: "side", index: 1 });
});

it("moves nothing when dropped outside every dock or cancelled", () => {
  const { onMove, start } = setup();
  press(start);
  fire("pointermove", 160, 80);
  fire("pointerup", 160, 80);

  press(start);
  fire("pointermove", 160);
  fire("pointercancel", 160);
  fire("pointerup", 160);
  expect(onMove).not.toHaveBeenCalled();
});

it("ignores presses other than the main button", () => {
  const { onMove, start } = setup();
  act(() => start("a", { button: 2 } as unknown as ReactPointerEvent));
  fire("pointermove", 160);
  fire("pointerup", 160);
  expect(onMove).not.toHaveBeenCalled();
});

it("drops nothing once unmounted mid-drag", () => {
  const { onMove, hook, start } = setup();
  press(start);
  fire("pointermove", 160);
  hook.unmount();
  fire("pointerup", 160);
  expect(onMove).not.toHaveBeenCalled();
});
