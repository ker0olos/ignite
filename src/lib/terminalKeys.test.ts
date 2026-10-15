import { describe, expect, it } from "vitest";
import { editingKey } from "./terminalKeys";

type Platform = Parameters<typeof editingKey>[1];

const key = (platform: Platform, key: string, mods: KeyboardEventInit = {}) =>
  editingKey(new KeyboardEvent("keydown", { key, ...mods }), platform);

describe("editingKey", () => {
  it("maps ⌘ keys to line start, end and delete line on macOS", () => {
    expect(key("mac", "ArrowLeft", { metaKey: true })).toBe("\x01");
    expect(key("mac", "ArrowRight", { metaKey: true })).toBe("\x05");
    expect(key("mac", "Backspace", { metaKey: true })).toBe("\x15");
  });

  it("maps ⌥ keys to word back, forward and delete word on macOS", () => {
    expect(key("mac", "ArrowLeft", { altKey: true })).toBe("\x1bb");
    expect(key("mac", "ArrowRight", { altKey: true })).toBe("\x1bf");
    expect(key("mac", "Backspace", { altKey: true })).toBe("\x17");
  });

  it("maps Ctrl keys to word moves and delete word on Linux", () => {
    expect(key("linux", "ArrowLeft", { ctrlKey: true })).toBe("\x1bb");
    expect(key("linux", "ArrowRight", { ctrlKey: true })).toBe("\x1bf");
    expect(key("linux", "Backspace", { ctrlKey: true })).toBe("\x17");
    expect(key("linux", "ArrowLeft", { altKey: true })).toBeUndefined();
  });

  it("leaves Windows' keys to PowerShell", () => {
    expect(key("windows", "ArrowLeft", { ctrlKey: true })).toBeUndefined();
    expect(key("windows", "Backspace", { ctrlKey: true })).toBeUndefined();
  });

  it("leaves other keys and combinations to xterm", () => {
    expect(key("mac", "ArrowLeft")).toBeUndefined();
    expect(key("mac", "k", { metaKey: true })).toBeUndefined();
    expect(
      key("mac", "ArrowLeft", { metaKey: true, altKey: true }),
    ).toBeUndefined();
    expect(
      key("mac", "ArrowLeft", { metaKey: true, shiftKey: true }),
    ).toBeUndefined();
    expect(key("mac", "ArrowLeft", { ctrlKey: true })).toBeUndefined();
  });

  it("reads the platform from the browser by default", () => {
    const e = new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true });
    expect(editingKey(e)).toBe("\x1bb");
  });
});
