import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNewTaskSheet } from "./useNewTaskSheet";

const press = (init: KeyboardEventInit) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", init));
  });

describe("useNewTaskSheet", () => {
  it("opens on ⌘N and Ctrl+N", () => {
    const mac = renderHook(() => useNewTaskSheet());
    press({ key: "n", metaKey: true });
    expect(mac.result.current[0]).toBe(true);

    const other = renderHook(() => useNewTaskSheet());
    mac.unmount();
    press({ key: "N", ctrlKey: true });
    expect(other.result.current[0]).toBe(true);
  });

  it("ignores N alone and ⇧⌘N (New Window)", () => {
    const { result } = renderHook(() => useNewTaskSheet());
    press({ key: "n" });
    press({ key: "n", metaKey: true, shiftKey: true });
    expect(result.current[0]).toBe(false);
  });

  it("stops listening once unmounted", () => {
    const { result, unmount } = renderHook(() => useNewTaskSheet());
    unmount();
    press({ key: "n", metaKey: true });
    expect(result.current[0]).toBe(false);
  });
});
