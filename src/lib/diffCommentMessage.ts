import type { CommentLine, DiffComment } from "@/lib/diffComments";
import type { DiffLine } from "@/lib/toolRows";

const MARK = { add: "added  ", del: "removed", ctx: "       " };

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

/** `src/app.ts:42-45`: by the new file's numbers, or the old file's when every line was removed. */
export function commentPlace(path: string, lines: CommentLine[]): string {
  const kept = lines.filter((l) => l.kind !== "del");
  const nums = (kept.length ? kept : lines).map((l) => l.num);
  const first = Math.min(...nums);
  const last = Math.max(...nums);
  const span = first === last ? `${first}` : `${first}-${last}`;
  return `${path}:${span}${kept.length ? "" : " (removed)"}`;
}

/** The quoted lines in a fence longer than any backtick run they hold. */
function quote(lines: CommentLine[]): string {
  const width = String(Math.max(...lines.map((l) => l.num))).length;
  const longest = Math.max(
    2,
    ...lines.flatMap((l) => (l.text.match(/`+/g) ?? []).map((m) => m.length)),
  );
  const fence = "`".repeat(longest + 1);
  const body = lines.map(
    (l) => `${String(l.num).padStart(width)} ${MARK[l.kind]}  ${l.text}`,
  );
  return [fence, ...body, fence].join("\n");
}

const byPlace = (a: DiffComment, b: DiffComment) =>
  a.repo.localeCompare(b.repo) ||
  a.path.localeCompare(b.path) ||
  Math.min(a.from, a.to) - Math.min(b.from, b.to) ||
  a.id - b.id;

/** The message comments send: one block per comment, in file and line order. */
export function commentsMessage(comments: DiffComment[]): string {
  return [...comments]
    .sort(byPlace)
    .map((c) =>
      [commentPlace(c.path, c.lines), quote(c.lines), c.text.trim()].join("\n"),
    )
    .join("\n\n");
}

/** The composer's draft with `added` after it, a blank line between. */
export function appendToDraft(draft: string, added: string): string {
  const kept = draft.trimEnd();
  return kept ? `${kept}\n\n${added}` : added;
}
