import type { CommentLine, SentComment } from "../../shared/sentComments";
import {
  clearDiffComments,
  diffComments,
  type DiffComment,
} from "@/lib/diffComments";
import type { DiffLine } from "@/lib/toolRows";

/** The commentable lines of rows `from` to `to` (in either order), gaps left out. */
export function commentLines(
  lines: DiffLine[],
  from: number,
  to: number,
): CommentLine[] {
  const [start, end] = from <= to ? [from, to] : [to, from];
  return lines
    .slice(start, end + 1)
    .filter((l): l is CommentLine => l.kind !== "gap");
}

const sameLines = (a: CommentLine[], b: CommentLine[]) =>
  a.length === b.length &&
  a.every((l, i) => l.kind === b[i].kind && l.text === b[i].text);

/** The comment where its lines are in `lines` now (the diff read again since): at its rows if they still match, else the nearest rows that do; null when they're gone. */
export function placeComment(
  lines: DiffLine[],
  comment: DiffComment,
): DiffComment | null {
  const span = Math.abs(comment.to - comment.from);
  const start = Math.min(comment.from, comment.to);
  const fits = (at: number) =>
    sameLines(commentLines(lines, at, at + span), comment.lines);
  const at = fits(start)
    ? start
    : lines
        .map((_, i) => i)
        .filter(fits)
        .sort((a, b) => Math.abs(a - start) - Math.abs(b - start))[0];
  return at === undefined ? null : { ...comment, from: at, to: at + span };
}

const byPlace = (a: DiffComment, b: DiffComment) =>
  (a.diff?.repo ?? "").localeCompare(b.diff?.repo ?? "") ||
  a.path.localeCompare(b.path) ||
  Math.min(a.from, a.to) - Math.min(b.from, b.to) ||
  a.id - b.id;

/** The comments as a message carries them, in file and line order. */
export function sentComments(comments: DiffComment[]): SentComment[] {
  return [...comments]
    .sort(byPlace)
    .map(({ path, lines, text }) => ({ path, lines, text }));
}

/** The conversation's diff comments, as a message or an answer carries them; they're forgotten, as they're being sent. */
export function takeComments(session: string | null): SentComment[] {
  const all = diffComments(session);
  clearDiffComments(session, all);
  return sentComments(all);
}
