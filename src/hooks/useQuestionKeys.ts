import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
} from "react";
import { approvalKey, isTyping } from "@/lib/approvalKeys";

/** The card's options and own-answer box, which ↑ and ↓ move between. */
const ITEMS = "[data-question-item]";

/**
 * While `active`: focuses the card's first option when it shows, ⌘↩ goes on
 * (↩ in the card's own text boxes, where ⌘↩ starts a new line), ⌘⌫ leaves it
 * to the agent and ⌘N goes to the own-answer box.
 * Returns the card's ↑/↓ handler, which works whether or not it's active.
 */
export function useQuestionKeys(
  card: RefObject<HTMLElement | null>,
  active: boolean,
  step: number,
  onNext: () => void,
  onSkip: () => void,
) {
  useEffect(() => {
    if (!active || isTyping(document.activeElement)) return;
    card.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, [card, active, step]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (boxEnter(card.current, e, onNext) || ownAnswer(card.current, e))
        return;
      const next = approvalKey(e);
      if (next === null) return;
      const inCard = !!card.current?.contains(document.activeElement);
      if (isTyping(document.activeElement) && !(next && inCard)) return;
      e.preventDefault();
      if (next) onNext();
      else onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, active, onNext, onSkip]);

  return (e: ReactKeyboardEvent) => moveFocus(card.current, e);
}

/** In the card's text boxes ↩ goes on and ⌘↩ starts a new line (Shift and Alt keep theirs); whether it handled `e`. */
function boxEnter(
  card: HTMLElement | null,
  e: KeyboardEvent,
  onNext: () => void,
) {
  const box = document.activeElement;
  if (!(box instanceof HTMLTextAreaElement) || !card?.contains(box))
    return false;
  if (e.key !== "Enter" || e.shiftKey || e.altKey || e.isComposing)
    return false;
  e.preventDefault();
  if (e.metaKey || e.ctrlKey) newline(box);
  else onNext();
  return true;
}

function newline(box: HTMLTextAreaElement) {
  box.setRangeText("\n", box.selectionStart, box.selectionEnd, "end");
  // React reads the new value from the input event.
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

/** ⌘N goes to the own-answer box; whether it handled `e`. */
function ownAnswer(card: HTMLElement | null, e: KeyboardEvent) {
  const mod = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
  if (!mod || e.key.toLowerCase() !== "n") return false;
  e.preventDefault();
  card?.querySelector<HTMLElement>("[data-own-answer]")?.focus();
  return true;
}

const ARROWS: Record<string, number | undefined> = {
  ArrowUp: -1,
  ArrowDown: 1,
};

function arrowStep(e: ReactKeyboardEvent) {
  const modified = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
  return modified ? undefined : ARROWS[e.key];
}

function atEdge(box: HTMLTextAreaElement, by: number) {
  const edge = by < 0 ? 0 : box.value.length;
  return box.selectionStart === edge && box.selectionEnd === edge;
}

/** ↑/↓ from one item to the next; in a text box only once the caret is at its start or end. */
function moveFocus(card: HTMLElement | null, e: ReactKeyboardEvent) {
  const by = arrowStep(e);
  const el = e.target as HTMLElement;
  if (!by || !card) return;
  if (el instanceof HTMLTextAreaElement && !atEdge(el, by)) return;
  const items = [...card.querySelectorAll<HTMLElement>(ITEMS)];
  const at = items.indexOf(el);
  const to = at < 0 ? undefined : items[at + by];
  if (!to) return;
  e.preventDefault();
  to.focus();
}
