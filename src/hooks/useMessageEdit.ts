import { useState, type KeyboardEvent } from "react";
import type { UserMessage } from "../../shared/agentTypes";
import type { MessageEdit } from "@/components/conversation/shared";
import { userParts } from "@/lib/rewind";

/**
 * One user message being edited in place: its text while editing, ↵ sends it
 * in the message's place (⇧↵ a new line), Esc cancels. Its images go with it.
 */
export function useMessageEdit(message: UserMessage, edit: MessageEdit | null) {
  const [text, setText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { images } = userParts(message);
  const entryId = message.entryId;

  const submit = async () => {
    if (!edit || edit.disabled || !entryId || text === null || sending) return;
    if (!text.trim() && !images.length) return;
    setSending(true);
    const sent = await edit.edit(entryId, text, images);
    setSending(false);
    if (sent) setText(null);
  };

  return {
    editing: text !== null,
    text: text ?? "",
    images,
    sending,
    setText,
    start: () => setText(userParts(message).text),
    cancel: () => setText(null),
    submit,
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setText(null);
      } else if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault();
        void submit();
      }
    },
  };
}
