import { act, renderHook } from "@testing-library/react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorOverlay } from "@/hooks/useEditorOverlay";

function at(left: number, right = 1000) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ left, right }) as DOMRect;
  return el;
}

function overlay() {
  const hook = renderHook(({ open }) => useEditorOverlay(320, open), {
    initialProps: { open: true },
  });
  const pane = document.createElement("div");
  hook.result.current.group.current = at(0);
  hook.result.current.agent.current = at(240);
  hook.result.current.pane.current = pane;
  return { result: hook.result, rerender: hook.rerender, pane };
}

const move = (clientX: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent("pointermove", { clientX }));
  });

const fire = (type: string) =>
  act(() => {
    window.dispatchEvent(new Event(type));
  });

const leftOf = (pane: HTMLElement) =>
  pane.style.getPropertyValue("--overlay-left");
const inset = (pane: HTMLElement) =>
  pane.style.getPropertyValue("--tabs-inset");

afterEach(() => vi.restoreAllMocks());

describe("useEditorOverlay", () => {
  it("draw over once dragged past the conversation's minimum, and give the space back", () => {
    const { result, pane } = overlay();
    act(() => result.current.follow());

    move(600);
    expect(result.current.over).toBe(false);
    move(500);
    expect(result.current.over).toBe(true);
    expect(leftOf(pane)).toBe("500px");
    move(-20);
    expect(leftOf(pane)).toBe("12px");
    expect(inset(pane)).toBe("0px");
    move(530);
    expect(result.current.over).toBe(false);
  });

  it("move the tabs clear of the traffic lights on macOS, and back once closed", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Macintosh");
    const { result, pane } = overlay();
    act(() => result.current.follow());
    move(30);
    expect(inset(pane)).toBe("66px");

    act(() => result.current.close());
    expect(result.current.over).toBe(false);
    expect(inset(pane)).toBe("");
    expect(leftOf(pane)).toBe("");
  });

  it("stop drawing over once the last tab closes", () => {
    const { result, rerender } = overlay();
    act(() => result.current.follow());
    move(100);
    expect(result.current.over).toBe(true);
    rerender({ open: false });
    expect(result.current.over).toBe(false);
  });

  it("go on resizing the editor when a drag from the overlay's edge ends up back in place", () => {
    const { result } = overlay();
    const resize = vi.fn();
    result.current.editor.current = {
      resize,
    } as unknown as PanelImperativeHandle;
    act(() => result.current.follow(true));
    move(100);
    expect(resize).not.toHaveBeenCalled();
    move(700);
    expect(result.current.over).toBe(false);
    expect(resize).toHaveBeenLastCalledWith("300px");
  });

  it("leave a drag of the panes' own divider to the panels library", () => {
    const { result } = overlay();
    const resize = vi.fn();
    result.current.editor.current = {
      resize,
    } as unknown as PanelImperativeHandle;
    act(() => result.current.follow());
    move(700);
    expect(resize).not.toHaveBeenCalled();
  });

  it.each(["pointerup", "pointercancel", "blur"])(
    "stop following on %s",
    (type) => {
      const { result } = overlay();
      act(() => result.current.follow());
      expect(result.current.dragging).toBe(true);
      fire(type);
      expect(result.current.dragging).toBe(false);
      move(100);
      expect(result.current.over).toBe(false);
    },
  );

  it("do nothing before the panes mount", () => {
    const { result } = renderHook(() => useEditorOverlay(320, true));
    act(() => result.current.follow());
    move(100);
    expect(result.current.over).toBe(false);
  });
});
