import { readFiles } from "./attachedFiles.ts";
import { typedSkill } from "./skills.ts";

/** A line a comment quotes: its kind and number (new file's, or old file's when removed). */
export type CommentLine = {
  kind: "add" | "del" | "ctx";
  num: number;
  text: string;
};

/** A diff comment as a message carries it: the file, the lines it's on, what it says. */
export type SentComment = { path: string; lines: CommentLine[]; text: string };

const OPEN = "<diff_comments>";
const CLOSE = "</diff_comments>";
const INTRO =
  "The user's comments on lines of a diff, each after the lines it's on:";
const MARK = { add: "added  ", del: "removed", ctx: "       " } as const;
const BLOCK = /(?:^|\n\n)<diff_comments>\n([\s\S]*)\n<\/diff_comments>$/;
const HEADER = /^@(.+):\d+(?:-\d+)?(?: \(removed\))?$/;
// `[^\n]`, not `.`: a CRLF file's lines keep their `\r`.
const QUOTED = /^ *(\d+) (added {2}|removed| {7}) {2}([^\n]*)$/;
const KIND = { "added  ": "add", removed: "del", "       ": "ctx" } as const;
// pi appends these after the text when it resizes or converts an image; an
// "[Image omitted: …]" among them stays, so the user sees the image was dropped.
const IMAGE_NOTE =
  /\[Image(?:: original \d+x\d+, displayed at \d+x\d+\. Multiply coordinates by [\d.]+ to map to original image\.| converted from \S+ to \S+\.)\]/
    .source;
const IMAGE_NOTES = new RegExp(
  `(?:^|\\n\\n)(?:${IMAGE_NOTE}\\n)*${IMAGE_NOTE}$`,
);

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

/** `message` with the comments after it: each an `@path:lines` mention, the quoted lines, the comment. */
export function withComments(message: string, comments: SentComment[]) {
  if (!comments.length) return message;
  const blocks = comments.map((c) =>
    [`@${commentPlace(c.path, c.lines)}`, quote(c.lines), c.text.trim()].join(
      "\n",
    ),
  );
  const block = [OPEN, INTRO, "", blocks.join("\n\n"), CLOSE].join("\n");
  return message.trim() ? `${message.trimEnd()}\n\n${block}` : block;
}

function readQuoted(line: string): CommentLine | null {
  const m = QUOTED.exec(line);
  if (!m) return null;
  return {
    kind: KIND[m[2] as keyof typeof KIND],
    num: Number(m[1]),
    text: m[3],
  };
}

/** The comment starting at `at`, before its text: its path, quoted lines and closing fence's line; null when none starts there. */
function headOf(lines: string[], at: number) {
  const path = HEADER.exec(lines[at] ?? "")?.[1];
  const fence = lines[at + 1];
  if (!path || !/^`{3,}$/.test(fence ?? "")) return null;
  const close = lines.indexOf(fence, at + 2);
  if (close < 0) return null;
  const quoted = lines.slice(at + 2, close).map(readQuoted);
  if (!quoted.length || quoted.includes(null)) return null;
  return { path, quoted: quoted as CommentLine[], close };
}

/** One comment from `lines` at `at`, its text running to the next comment that reads back; null when it isn't one. */
function readOne(lines: string[], at: number) {
  const head = headOf(lines, at);
  if (!head) return null;
  let end = head.close + 1;
  while (end < lines.length && !headOf(lines, end)) end++;
  const text = lines
    .slice(head.close + 1, end)
    .join("\n")
    .trim();
  return { comment: { path: head.path, lines: head.quoted, text }, end };
}

/** A message's own text and the diff comments it carries; none when it carries none, or they don't read back. */
export function readComments(message: string): {
  text: string;
  comments: SentComment[];
} {
  const m = BLOCK.exec(message);
  const lines = m?.[1].split("\n") ?? [];
  if (lines[0] !== INTRO) return { text: message, comments: [] };
  const comments: SentComment[] = [];
  for (let at = 2; at < lines.length;) {
    const one = readOne(lines, at);
    if (!one) return { text: message, comments: [] };
    comments.push(one.comment);
    at = one.end;
  }
  return { text: message.slice(0, m!.index).trimEnd(), comments };
}

/** A message's own text (a skill still expanded, pi's image notes left out), and the files and diff comments it carries. */
export function readMessage(message: string) {
  const { text: rest, comments } = readComments(
    message.replace(IMAGE_NOTES, ""),
  );
  const { text, files } = readFiles(rest);
  return { text, files, comments };
}

/** A message as the user wrote it: a skill as its `/name`, its diff comments and files left out (named when it's only them). */
export function typedMessage(message: string): string {
  const { text, files, comments } = readMessage(message);
  const typed = typedSkill(text);
  if (typed) return typed;
  if (comments.length) {
    const n = comments.length;
    return `${n} ${n === 1 ? "comment" : "comments"} on ${comments[0].path}`;
  }
  return files.map((f) => f.path.split(/[\\/]/).pop()).join(", ");
}
