import { useSyncExternalStore } from "react";
import {
  addDiffComment,
  diffComments,
  editDiffComment,
  removeDiffComment,
  subscribeDiffComments,
  type DiffComment,
} from "@/lib/diffComments";
import { commentLines } from "@/lib/diffCommentMessage";
import type { DiffTab } from "@/lib/diffTabs";
import type { DiffLine } from "@/lib/toolRows";

/**
 * A diff tab's comments: adding, editing and deleting them. Each goes straight into the
 * message of the conversation that opened the diff, else the one `shown`.
 */
export function useDiffComments(tab: DiffTab, shown: string | null) {
  const key = tab.session ?? shown;
  const all = useSyncExternalStore(subscribeDiffComments, () =>
    diffComments(key),
  );
  const mine = (c: DiffComment) =>
    c.diff?.repo === tab.repo &&
    c.diff.range === tab.range &&
    c.path === tab.path;
  return {
    /** This tab's comments. */
    comments: all.filter(mine),
    add: (lines: DiffLine[], from: number, to: number, text: string) =>
      addDiffComment(key, {
        diff: {
          repo: tab.repo,
          range: tab.range,
          status: tab.status,
          session: tab.session,
        },
        path: tab.path,
        from,
        to,
        lines: commentLines(lines, from, to),
        text,
      }),
    edit: (id: number, text: string) => editDiffComment(key, id, text),
    remove: (id: number) => removeDiffComment(key, id),
  };
}
