import { useState, type KeyboardEvent } from "react";
import type { UserMessage } from "../../shared/agentTypes";
import { withFiles } from "../../shared/attachedFiles";
import { withComments } from "../../shared/sentComments";
import type { MessageEdit } from "@/components/conversation/shared";
import { readUserMessage } from "@/lib/userMessage";

/**
 * One user message being edited in place: its text while editing, ↵ sends it
 * in the message's place (⇧↵ a new line), Esc cancels. Its images, files and
 * diff comments go with it.
 */
export function useMessageEdit(message: UserMessage, edit: MessageEdit | null) {
  const [text, setText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { images, files, comments } = readUserMessage(message);
  const entryId = message.entryId;

  const empty =
    !text?.trim() && !images.length && !files.length && !comments.length;

  const submit = async () => {
    if (!edit || edit.disabled || !entryId || text === null) return;
    if (sending || empty) return;
    setSending(true);
    // Attached as the composer does: files, then comments.
    const full = withComments(withFiles(text, files), comments);
    const sent = await edit.edit(entryId, full, images);
    setSending(false);
    if (sent) setText(null);
  };

  return {
    editing: text !== null,
    text: text ?? "",
    images,
    sending,
    setText,
    start: () => setText(readUserMessage(message).text),
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
