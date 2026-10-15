import { type RefObject, useEffect } from "react";

// Focus here is the user's: typing, the terminal (xterm's textarea), an artifact, a question's options.
const KEEP =
  "input, textarea, select, [contenteditable=true], iframe, [role=radio], [role=checkbox], [role=option]";
const OPEN = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";

/** Five times a second, focuses the composer unless something else has the user: a text field, an open menu or dialog, a selection. */
export function useComposerFocus(input: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    // A focus there opens the on-screen keyboard.
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    let pressed = false;
    const down = () => (pressed = true);
    const up = () => (pressed = false);
    const tick = () => {
      const composer = input.current;
      if (!composer || pressed || !document.hasFocus()) return;
      if (!inUse(composer)) composer.focus({ preventScroll: true });
    };

    tick();
    // Cheap: while the composer has focus, a tick is one comparison.
    const id = setInterval(tick, 200);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("blur", up);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("blur", up);
    };
  }, [input]);
}

/** Whether the composer, or something else, has the user. */
function inUse(composer: HTMLTextAreaElement) {
  const active = document.activeElement;
  if (active === composer || active?.closest(KEEP)) return true;
  // Tabbed to; a menu's button hands focus back however its menu closed.
  if (active?.matches(":focus-visible:not([aria-haspopup])")) return true;
  if (document.querySelector(OPEN)) return true;
  return document.getSelection()?.isCollapsed === false;
}
