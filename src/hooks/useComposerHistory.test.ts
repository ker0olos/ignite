import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerHistory } from "./useComposerHistory";
import { loadHistory, saveHistory } from "@/lib/history";

const key = (
  name: string,
  text: string,
  caret = text.length,
  more: Partial<KeyboardEvent> = {},
) => {
  const el = document.createElement("textarea");
  el.value = text;
  el.setSelectionRange(caret, caret);
  return {
    key: name,
    currentTarget: el,
    nativeEvent: { isComposing: false },
    preventDefault: vi.fn(),
    ...more,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
};

function setup() {
  const state = { text: "" };
  const hook = renderHook(
    ({ text }) =>
      useComposerHistory(text, (t) => (state.text = t), {
        current: null,
      }),
    { initialProps: { text: "" } },
  );
  const press = (name: string, more?: Partial<KeyboardEvent>) => {
    let handled = false;
    act(() => {
      handled = hook.result.current.onKeyDown(
        key(name, state.text, name === "ArrowUp" ? 0 : undefined, more),
      );
    });
    hook.rerender({ text: state.text });
    return handled;
  };
  const type = (text: string) => {
    state.text = text;
    hook.rerender({ text });
  };
  return { state, hook, press, type };
}

beforeEach(() => localStorage.clear());

describe("history storage", () => {
  it("skips blanks and a repeat of the last, and keeps the newest 100", () => {
    saveHistory("  ");
    saveHistory("one");
    saveHistory("one");
    expect(loadHistory()).toEqual(["one"]);
    for (let i = 0; i < 120; i++) saveHistory(`m${i}`);
    expect(loadHistory()).toHaveLength(100);
    expect(loadHistory().at(-1)).toBe("m119");
  });

  it("reads nothing from bad or broken storage", () => {
    localStorage.setItem("composer-history", "{}");
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("composer-history", "not json");
    expect(loadHistory()).toEqual([]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveHistory("x")).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("useComposerHistory", () => {
  it("steps back through sent messages and forward to the draft", () => {
    saveHistory("first");
    saveHistory("second");
    const { state, press, type } = setup();
    type("draft");
    expect(press("ArrowDown")).toBe(false);
    expect(press("ArrowUp")).toBe(true);
    expect(state.text).toBe("second");
    press("ArrowUp");
    expect(state.text).toBe("first");
    expect(press("ArrowUp")).toBe(false);
    press("ArrowDown");
    press("ArrowDown");
    expect(state.text).toBe("draft");
    expect(press("ArrowDown")).toBe(false);
  });

  it("leaves ↑ and ↓ to the caret until it's at the start or end", () => {
    saveHistory("sent");
    const { hook, state, press, type } = setup();
    type("a long line wrapped\ntwo");
    const { onKeyDown } = hook.result.current;
    expect(onKeyDown(key("ArrowUp", state.text, 5))).toBe(false);
    expect(press("ArrowUp", { shiftKey: true })).toBe(false);
    expect(onKeyDown(key("ArrowUp", state.text, 2, { metaKey: true }))).toBe(
      false,
    );
    expect(onKeyDown(key("Enter", state.text))).toBe(false);
    act(() => {
      expect(onKeyDown(key("ArrowUp", state.text, 0))).toBe(true);
    });
    expect(state.text).toBe("sent");
  });

  it("ends browsing once the shown message is edited", () => {
    saveHistory("first");
    saveHistory("second");
    const { state, press, type } = setup();
    type("draft");
    press("ArrowUp");
    type("second, edited");
    expect(press("ArrowDown")).toBe(false);
    expect(state.text).toBe("second, edited");
    press("ArrowUp");
    expect(state.text).toBe("second");
    press("ArrowDown");
    expect(state.text).toBe("second, edited");
  });

  it("browses the history as it was when browsing started", () => {
    saveHistory("first");
    const { state, press } = setup();
    press("ArrowUp");
    saveHistory("from another window");
    press("ArrowDown");
    expect(state.text).toBe("");
  });

  it("records what's sent and starts again from the newest", () => {
    const { hook, state, press } = setup();
    act(() => hook.result.current.record("hello"));
    expect(loadHistory()).toEqual(["hello"]);
    press("ArrowUp");
    expect(state.text).toBe("hello");
  });
});
