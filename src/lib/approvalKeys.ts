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

/** The shortcut hints, with the platform's modifier. */
export function approvalHints(isMac = navigator.userAgent.includes("Mac")) {
  const mod = isMac ? "⌘" : "Ctrl+";
  return { approve: `${mod}↩`, deny: `${mod}⌫` };
}

/** Whether `el` takes typed text, where the shortcuts must keep their usual meaning. */
export function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
}
