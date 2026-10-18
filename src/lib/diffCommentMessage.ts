import type { CommentLine, SentComment } from "../../shared/sentComments";
import type { DiffComment } from "@/lib/diffComments";
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
