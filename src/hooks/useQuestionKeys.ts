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
 * (even from the card's own text boxes), ⌘⌫ leaves it to the agent and ⌘N
 * goes to the own-answer box.
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
      if (isOwnAnswerKey(e)) {
        e.preventDefault();
        card.current?.querySelector<HTMLElement>("[data-own-answer]")?.focus();
        return;
      }
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

function isOwnAnswerKey(e: KeyboardEvent) {
  const mod = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
  return mod && e.key.toLowerCase() === "n";
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
