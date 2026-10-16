import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { QuestionDeck } from "@/hooks/useQuestionDeck";
import { approvalKey, isTyping } from "@/lib/approvalKeys";
import { pickKey, typesText } from "@/lib/questions";

const OPTIONS = "[data-question-item]";

const plain = (e: KeyboardEvent) =>
  !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey);

/** A shown question's keys (⌥1…⌥9 pick, ⌘↩ on, ⌘⌫ skip, ⌘N the text) and its options' and text's handlers. */
export function useComposerQuestionKeys(
  deck: QuestionDeck | null,
  options: RefObject<HTMLElement | null>,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const latest = useRef(deck);
  useLayoutEffect(() => {
    latest.current = deck;
  });
  const active = !!deck;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const shown = latest.current;
      if (!shown || typingElsewhere(input.current)) return;
      if (toInput(e, input.current)) return;
      const i = pickKey(e);
      if (i !== null) {
        e.preventDefault();
        pickOption(shown, i);
        return;
      }
      const on = approvalKey(e);
      if (on === null) return;
      if (!on && isTyping(document.activeElement)) return;
      e.preventDefault();
      if (on) shown.next();
      else shown.skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, input]);

  const onOptionKey = (e: KeyboardEvent<HTMLElement>) => {
    if (!deck) return;
    const items = [
      ...(options.current?.querySelectorAll<HTMLElement>(OPTIONS) ?? []),
    ];
    const at = items.indexOf(e.target as HTMLElement);
    if (!plain(e) || at < 0) return;
    const to = moveTo(e.key, at, items, input.current);
    if (to) {
      e.preventDefault();
      to.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      deck.next();
    } else if (typesText(e)) {
      e.preventDefault();
      deck.setText(deck.draft.text + e.key);
      input.current?.focus();
    }
  };

  /** The text's keys; true when one was the question's. */
  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!deck || !plain(e) || e.nativeEvent.isComposing) return false;
    const box = e.currentTarget;
    const atStart = box.selectionStart === 0 && box.selectionEnd === 0;
    if (e.key === "ArrowUp" && atStart) {
      e.preventDefault();
      lastOption(options.current)?.focus();
      return true;
    }
    if (e.key !== "Enter") return false;
    e.preventDefault();
    deck.next();
    return true;
  };

  return { onOptionKey, onInputKey };
}

const FIELD = "input, textarea, select, [contenteditable=true]";

/** Whether focus is in a field outside the composer (a terminal, a dialog, the task sheet), whose keys stay its own. */
function typingElsewhere(input: HTMLTextAreaElement | null) {
  const active = document.activeElement;
  if (!active?.matches(FIELD)) return false;
  return !input?.form?.contains(active);
}

function pickOption(deck: QuestionDeck, i: number) {
  const option = deck.question.options[i];
  if (option) deck.toggle(option.label);
}

function lastOption(list: HTMLElement | null) {
  return [...(list?.querySelectorAll<HTMLElement>(OPTIONS) ?? [])].at(-1);
}

function moveTo(
  key: string,
  at: number,
  items: HTMLElement[],
  input: HTMLTextAreaElement | null,
) {
  if (key === "ArrowUp") return items[at - 1];
  if (key === "ArrowDown") return items[at + 1] ?? input;
  return undefined;
}

/** ⌘N goes to the composer's text; whether it handled `e`. */
function toInput(
  e: globalThis.KeyboardEvent,
  input: HTMLTextAreaElement | null,
) {
  const mod = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
  if (!mod || e.key.toLowerCase() !== "n") return false;
  e.preventDefault();
  input?.focus();
  return true;
}
