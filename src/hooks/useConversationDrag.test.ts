import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConversationDrag } from "./useConversationDrag";

// Rows a (y 0–30) and b (y 30–60) of /a, c (y 60–90) of /b; y > 90 is no row.
let rows: HTMLElement[];

beforeEach(() => {
  rows = [
    ["a", "/a"],
    ["b", "/a"],
    ["c", "/b"],
  ].map(([session, folder], i) => {
    const row = document.createElement("div");
    row.dataset.conversation = session;
    row.dataset.folder = folder;
    row.getBoundingClientRect = () => ({ top: i * 30, height: 30 }) as DOMRect;
    row.setPointerCapture = vi.fn();
    document.body.append(row);
    return row;
  });
  document.elementFromPoint = (_x: number, y: number) =>
    rows[Math.floor(y / 30)] ?? document.body;
});

afterEach(() => rows.forEach((r) => r.remove()));

const fire = (type: string, y: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: 0, clientY: y }));
  });

function setup() {
  const onMove = vi.fn();
  const hook = renderHook(() => useConversationDrag(onMove));
  const press = (y = 10, button = 0) =>
    act(() =>
      hook.result.current.row("/a", "a").onPointerDown({
        button,
        currentTarget: rows[0],
        pointerId: 1,
        clientX: 0,
        clientY: y,
      } as unknown as ReactPointerEvent),
    );
  return { onMove, hook, press };
}

it("leaves a press that barely moves to the click", () => {
  const { onMove, hook, press } = setup();
  press();
  fire("pointermove", 12);
  expect(hook.result.current.drag).toBeNull();
  fire("pointerup", 12);
  expect(onMove).not.toHaveBeenCalled();
  expect(rows[0].setPointerCapture).not.toHaveBeenCalled();
});

it("drops before or after a row of its folder, marking both rows meanwhile", () => {
  const { onMove, hook, press } = setup();
  press();
  fire("pointermove", 50);
  expect(hook.result.current.row("/a", "a").dragging).toBe(true);
  expect(rows[0].setPointerCapture).toHaveBeenCalledWith(1);
  expect(hook.result.current.row("/a", "b").edge).toBe("after");
  expect(hook.result.current.row("/b", "b").edge).toBeNull();
  fire("pointerup", 50);
  expect(onMove).toHaveBeenLastCalledWith("/a", "a", {
    target: "b",
    after: true,
  });
  expect(hook.result.current.drag).toBeNull();

  press();
  fire("pointermove", 35);
  fire("pointerup", 35);
  expect(onMove).toHaveBeenLastCalledWith("/a", "a", {
    target: "b",
    after: false,
  });
});

it("swallows the click that ends a drag, not a later one", () => {
  const { press } = setup();
  const onClick = vi.fn();
  rows[0].addEventListener("click", onClick);
  press();
  fire("pointermove", 50);
  fire("pointerup", 50);
  rows[0].click();
  expect(onClick).not.toHaveBeenCalled();
  rows[0].click();
  expect(onClick).toHaveBeenCalledOnce();
});

it("moves nothing onto itself, another folder's row, no row, or once cancelled", () => {
  const { onMove, press } = setup();
  for (const y of [20, 70, 120]) {
    press();
    fire("pointermove", y);
    fire("pointerup", y);
  }
  press();
  fire("pointermove", 50);
  fire("pointercancel", 50);
  fire("pointerup", 50);
  expect(onMove).not.toHaveBeenCalled();
});

it("ignores presses other than the main button", () => {
  const { onMove, press } = setup();
  press(10, 2);
  fire("pointermove", 50);
  fire("pointerup", 50);
  expect(onMove).not.toHaveBeenCalled();
});
