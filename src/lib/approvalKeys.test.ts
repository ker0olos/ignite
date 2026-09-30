import { describe, expect, it } from "vitest";
import { approvalHints, approvalKey, isTyping, shortcut } from "./approvalKeys";

const key = (key: string, mods: Partial<Record<string, boolean>> = {}) =>
  approvalKey({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });

describe("approvalKey", () => {
  it("approves with ⌘↩ and denies with ⌘⌫, or Ctrl", () => {
    expect(key("Enter", { metaKey: true })).toBe(true);
    expect(key("Backspace", { metaKey: true })).toBe(false);
    expect(key("Enter", { ctrlKey: true })).toBe(true);
  });

  it("ignores other keys and modifiers", () => {
    expect(key("Enter")).toBeNull();
    expect(key("Enter", { metaKey: true, shiftKey: true })).toBeNull();
    expect(key("Backspace", { metaKey: true, altKey: true })).toBeNull();
    expect(key("a", { metaKey: true })).toBeNull();
  });
});

describe("shortcut", () => {
  it("uses ⌘ on macOS and Ctrl+ elsewhere", () => {
    expect(shortcut("V", true)).toBe("⌘V");
    expect(shortcut("V", false)).toBe("Ctrl+V");
  });
});

describe("approvalHints", () => {
  it("names the platform's modifier", () => {
    expect(approvalHints(true)).toEqual({ approve: "⌘↩", deny: "⌘⌫" });
    expect(approvalHints(false)).toEqual({ approve: "Ctrl+↩", deny: "Ctrl+⌫" });
  });
});

describe("isTyping", () => {
  it("is true in text boxes with text only", () => {
    const area = document.createElement("textarea");
    expect(isTyping(area)).toBe(false);
    area.value = "hi";
    expect(isTyping(area)).toBe(true);
    const input = document.createElement("input");
    expect(isTyping(input)).toBe(false);
    input.value = "hi";
    expect(isTyping(input)).toBe(true);
    expect(isTyping(document.createElement("select"))).toBe(true);
    expect(isTyping(document.createElement("button"))).toBe(false);
    expect(isTyping(document.body)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
