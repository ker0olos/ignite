import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useConversationShortcuts } from "./useConversationShortcuts";

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", { cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
};

const rows = Array.from({ length: 10 }, (_, i) => ({
  cwd: i < 5 ? "/a" : "/b",
  session: `s${i + 1}`,
}));

beforeEach(() => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mac");
});

it("numbers the first nine rows and shows one on ⌘ and its digit", () => {
  const show = vi.fn();
  const { result } = renderHook(() => useConversationShortcuts(rows, show));
  expect([...result.current.values()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(result.current.has("s10")).toBe(false);

  expect(press({ metaKey: true, code: "Digit1" }).defaultPrevented).toBe(true);
  press({ metaKey: true, code: "Digit9" });
  expect(show.mock.calls).toEqual([
    ["/a", "s1"],
    ["/b", "s9"],
  ]);
});

it("ignores ⌘0, a digit past the rows, other modifiers, Ctrl and a bare digit", () => {
  const show = vi.fn();
  renderHook(() => useConversationShortcuts(rows.slice(0, 2), show));
  expect(press({ metaKey: true, code: "Digit0" }).defaultPrevented).toBe(false);
  press({ metaKey: true, code: "Digit3" });
  press({ metaKey: true, shiftKey: true, code: "Digit1" });
  press({ metaKey: true, altKey: true, code: "Digit1" });
  press({ ctrlKey: true, code: "Digit1" });
  press({ code: "Digit1" });
  expect(show).not.toHaveBeenCalled();
});

it("does nothing while a dialog is open", () => {
  const show = vi.fn();
  renderHook(() => useConversationShortcuts(rows, show));
  const dialog = document.body.appendChild(document.createElement("div"));
  dialog.setAttribute("role", "dialog");
  press({ metaKey: true, code: "Digit1" });
  dialog.remove();
  expect(show).not.toHaveBeenCalled();
});
