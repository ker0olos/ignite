import { useSyncExternalStore } from "react";
import { readComments, withComments } from "../../shared/sentComments";
import {
  addDiffComment,
  clearDiffComments,
  diffComments,
  removeDiffComment,
  subscribeDiffComments,
} from "@/lib/diffComments";
import { sentComments } from "@/lib/diffCommentMessage";

/** The diff comments in the conversation's message: removing one, sending them with it, taking them back with a queued one. */
export function useComposerComments(session: string | null) {
  const all = useSyncExternalStore(subscribeDiffComments, () =>
    diffComments(session),
  );
  return {
    comments: all,
    remove: (id: number) => removeDiffComment(session, id),
    /** `message` with the comments after it; they're forgotten, as it's being sent. */
    take: (message: string) => {
      clearDiffComments(session, all);
      return withComments(message, sentComments(all));
    },
    /** Puts the comments of messages taken back from the queue in the message again. */
    restore: (messages: string[]) =>
      messages
        .flatMap((m) => readComments(m).comments)
        .forEach((c) => addDiffComment(session, { ...c, from: -1, to: -1 })),
  };
}
