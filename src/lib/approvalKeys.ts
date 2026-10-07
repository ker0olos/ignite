import { isMac } from "./window";

/** ⌘↩ approves and ⌘⌫ denies the first waiting call (Ctrl off macOS). */
export function approvalKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean | null {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return null;
  if (e.key === "Enter") return true;
  return e.key === "Backspace" ? false : null;
}

/** A ⌘ shortcut as the platform writes it: ⌘V on macOS, Ctrl+V elsewhere. */
export function shortcut(key: string, mac = isMac()) {
  return `${mac ? "⌘" : "Ctrl+"}${key}`;
}

/** The shortcut hints, with the platform's modifier. */
export function approvalHints(mac = isMac()) {
  return { approve: shortcut("↩", mac), deny: shortcut("⌫", mac) };
}

/** Whether `el` holds typed text, where the shortcuts must keep their usual meaning; an empty box doesn't. */
export function isTyping(el: Element | null): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    return el.value !== "";
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable ? !!el.textContent : el.tagName === "SELECT";
}
