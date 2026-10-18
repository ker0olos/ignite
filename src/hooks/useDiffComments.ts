import { useSyncExternalStore } from "react";
import { appendToComposer } from "@/lib/composerText";
import {
  addDiffComment,
  clearDiffComments,
  diffComments,
  editDiffComment,
  removeDiffComment,
  subscribeDiffComments,
  type DiffComment,
} from "@/lib/diffComments";
import { commentLines, commentsMessage } from "@/lib/diffCommentMessage";
import type { DiffTab } from "@/lib/diffTabs";
import type { DiffLine } from "@/lib/toolRows";

/** Where sent comments go: the conversation shown now, and showing another. */
export type CommentTarget = {
  shown: string | null;
  show: (session: string) => void;
};

/**
 * A diff tab's comments, kept for its conversation (the one that opened it):
 * adding, editing and deleting them, and sending all of that conversation's to its composer.
 */
export function useDiffComments(tab: DiffTab, target: CommentTarget) {
  const key = tab.session ?? null;
  const all = useSyncExternalStore(subscribeDiffComments, () =>
    diffComments(key),
  );
  const mine = (c: DiffComment) =>
    c.repo === tab.repo && c.range === tab.range && c.path === tab.path;
  return {
    /** This tab's comments. */
    comments: all.filter(mine),
    /** The conversation's comments, this tab's and others'. */
    count: all.length,
    add: (lines: DiffLine[], from: number, to: number, text: string) =>
      addDiffComment(key, {
        repo: tab.repo,
        range: tab.range,
        path: tab.path,
        from,
        to,
        lines: commentLines(lines, from, to),
        text,
      }),
    edit: (id: number, text: string) => editDiffComment(key, id, text),
    remove: (id: number) => removeDiffComment(key, id),
    /** Adds every comment to the conversation's draft (showing it first), then forgets them. */
    send: () => {
      const sent = diffComments(key);
      if (!sent.length) return;
      const to = tab.session ?? target.shown;
      if (to !== target.shown && to) target.show(to);
      appendToComposer(to, commentsMessage(sent));
      clearDiffComments(key, sent);
    },
  };
}
