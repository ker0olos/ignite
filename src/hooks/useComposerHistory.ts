import { useState, type KeyboardEvent, type RefObject } from "react";
import { historyStep, saveHistory, type Browse } from "@/lib/history";

const STEPS: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

const modified = (e: KeyboardEvent) =>
  e.shiftKey || e.metaKey || e.altKey || e.ctrlKey || e.nativeEvent.isComposing;

/** ↑ and ↓ step through every sent message, like a shell (`historyStep`). */
export function useComposerHistory(
  text: string,
  setText: (text: string) => void,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const [browse, setBrowse] = useState<Browse | null>(null);

  /** Handles ↑/↓ when they leave the text; true when it was theirs. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = e.currentTarget;
    const step = STEPS[e.key];
    if (!step || modified(e) || selectionStart !== selectionEnd) return false;
    const next = historyStep(text, selectionStart, step, browse);
    if (!next) return false;
    setBrowse(next.browse);
    setText(next.text);
    const end = next.text.length;
    requestAnimationFrame(() => input.current?.setSelectionRange(end, end));
    e.preventDefault();
    return true;
  };

  /** Remembers a sent message and stops browsing. */
  const record = (sent: string) => {
    saveHistory(sent);
    setBrowse(null);
  };

  return { onKeyDown, record };
}
