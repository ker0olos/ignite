import { describe, expect, it } from "vitest";
import { composerKey, takenText } from "./queue";

describe("takenText", () => {
  it("puts taken-back messages above what's typed, skipping blanks", () => {
    expect(takenText([{ text: "a" }, { text: "" }], "typing")).toBe(
      "a\n\ntyping",
    );
    expect(takenText([{ text: "a" }], "")).toBe("a");
    expect(takenText([], "typing")).toBe("typing");
  });
});

describe("composerKey", () => {
  const key = (k: string, mods: Partial<Record<string, boolean>> = {}) => ({
    key: k,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    ...mods,
  });
  const at = { running: true, empty: true, queued: true };

  it("stops a run with esc, and does nothing with it otherwise", () => {
    expect(composerKey(key("Escape"), at)).toBe("stop");
    expect(composerKey(key("Escape"), { ...at, running: false })).toBeNull();
  });

  it("sends the first queued message now with ⇧⌘↵ and nothing typed", () => {
    const now = key("Enter", { metaKey: true, shiftKey: true });
    expect(composerKey(now, at)).toBe("now");
    expect(composerKey(now, { ...at, empty: false })).toBeNull();
    expect(composerKey(now, { ...at, queued: false })).toBeNull();
  });

  it("sends with ↵", () => {
    expect(composerKey(key("Enter"), at)).toBe("send");
  });

  it("leaves new lines, IME input and other keys alone", () => {
    expect(composerKey(key("Enter", { shiftKey: true }), at)).toBeNull();
    expect(composerKey(key("Enter", { isComposing: true }), at)).toBeNull();
    expect(composerKey(key("a"), at)).toBeNull();
  });
});
