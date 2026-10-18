import { type RefObject, useEffect, useRef } from "react";
import { addTextTarget } from "@/lib/composerText";
import { appendToDraft } from "@/lib/diffCommentMessage";

/** Makes this composer where text for conversation `session` goes (diff comments): added after its draft, focused with the caret at the end. */
export function useProvideComposerText(
  session: string | null,
  setText: (text: (current: string) => string) => void,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const latest = useRef(setText);
  useEffect(() => {
    latest.current = setText;
  });
  useEffect(
    () =>
      addTextTarget({
        session,
        append: (added) => {
          latest.current((current) => appendToDraft(current, added));
          requestAnimationFrame(() => {
            const box = input.current;
            if (!box) return;
            box.focus();
            box.setSelectionRange(box.value.length, box.value.length);
          });
        },
      }),
    [session, input],
  );
}
