import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposerFocus } from "./useComposerFocus";

function setup() {
  const composer = document.createElement("textarea");
  const text = document.createElement("p");
  text.textContent = "some conversation text";
  document.body.append(composer, text);
  const hook = renderHook(() => useComposerFocus({ current: composer }));
  return { composer, text, ...hook };
}

function add<K extends keyof HTMLElementTagNameMap>(tag: K, role?: string) {
  const el = document.createElement(tag);
  if (role) el.setAttribute("role", role);
  document.body.append(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe("useComposerFocus", () => {
  it("focuses the composer on mount", () => {
    const { composer } = setup();
    expect(document.activeElement).toBe(composer);
  });

  it("takes focus back within 200ms when nothing has it", () => {
    const { composer } = setup();
    composer.blur();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(composer);
  });

  it("takes it from a closed menu's button", () => {
    const { composer } = setup();
    const trigger = add("button");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.focus();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(composer);
  });

  it("leaves a button reached with Tab, but not a menu's button", () => {
    const { composer } = setup();
    const send = add("button");
    const menu = add("button");
    menu.setAttribute("aria-haspopup", "menu");
    const visible = vi.spyOn(Element.prototype, "matches");
    visible.mockImplementation(function (this: Element, s: string) {
      return s.startsWith(":focus-visible") && this === send;
    });
    send.focus();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(send);
    menu.focus();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(composer);
  });

  it.each([
    ["an input", () => add("input")],
    ["a terminal's textarea", () => add("textarea")],
    ["a question's option", () => add("button", "radio")],
  ])("leaves focus in %s", (_, make) => {
    setup();
    const el = make();
    el.focus();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(el);
  });

  it.each(["menu", "dialog", "listbox"])("waits while a %s is open", (role) => {
    const { composer } = setup();
    const open = add("div", role);
    composer.blur();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
    open.remove();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(composer);
  });

  it("keeps a text selection", () => {
    const { composer, text } = setup();
    composer.blur();
    document.getSelection()?.selectAllChildren(text);
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
  });

  it("waits while a mouse button is down", () => {
    const { composer } = setup();
    composer.blur();
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
    window.dispatchEvent(new Event("pointercancel"));
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(composer);
  });

  it("does nothing while the window is in the background", () => {
    const { composer } = setup();
    vi.mocked(document.hasFocus).mockReturnValue(false);
    composer.blur();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
  });

  it("does nothing on touch screens", () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q === "(pointer: coarse)",
    })) as typeof window.matchMedia;
    setup();
    window.matchMedia = matchMedia;
    expect(document.activeElement).toBe(document.body);
  });

  it("stops after unmount", () => {
    const { composer, unmount } = setup();
    unmount();
    composer.blur();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
  });
});
