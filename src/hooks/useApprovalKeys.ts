import { useEffect } from "react";
import { approvalKey, isTyping } from "@/lib/approvalKeys";

/** Answers a waiting call from the keyboard while `active`, unless a text box with text has focus. */
export function useApprovalKeys(
  active: boolean,
  onAnswer: (approved: boolean) => void,
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const approved = approvalKey(e);
      if (approved === null || isTyping(document.activeElement)) return;
      e.preventDefault();
      onAnswer(approved);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onAnswer]);
}
