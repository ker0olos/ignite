import type { Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/toolRows";

export type Range = [start: number, end: number];

const WORDS = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;
const MAX_CELLS = 100_000;
// ponytail: cleared whole once full; an LRU if long diffs thrash it
const cache = new Map<string, [Range[], Range[]] | null>();
const CACHE_PAIRS = 2_000;

/** The changed words of each removed line paired with the added line in the same place after it, by row. */
export function changedRanges(lines: DiffLine[]): Map<number, Range[]> {
  const out = new Map<number, Range[]>();
  let i = 0;
  while (i < lines.length) {
    const dels = runEnd(lines, i, "del");
    const adds = runEnd(lines, dels, "add");
    for (let k = 0; k < Math.min(dels - i, adds - dels); k++) {
      const ranges = cachedRanges(
        textOf(lines[i + k]),
        textOf(lines[dels + k]),
      );
      if (!ranges) continue;
      out.set(i + k, ranges[0]);
      out.set(dels + k, ranges[1]);
    }
    i = Math.max(adds, i + 1);
  }
  return out;
}

/** A line's tokens cut where the changed ranges start and end, each piece marked whether it changed. */
export function markTokens(
  tokens: Token[],
  ranges: Range[] = [],
): (Token & { changed: boolean })[] {
  const out: (Token & { changed: boolean })[] = [];
  let pos = 0;
  for (const t of tokens) {
    for (let s = 0; s < t.content.length;) {
      const r = ranges.find(([, end]) => pos + s < end);
      const changed = r !== undefined && pos + s >= r[0];
      const cut = r === undefined ? Infinity : changed ? r[1] : r[0];
      const end = Math.min(t.content.length, cut - pos);
      out.push({ content: t.content.slice(s, end), style: t.style, changed });
      s = end;
    }
    pos += t.content.length;
  }
  return out;
}

function runEnd(lines: DiffLine[], from: number, kind: "add" | "del") {
  let i = from;
  while (lines[i]?.kind === kind) i++;
  return i;
}

function textOf(line: DiffLine) {
  return line.kind === "gap" ? "" : line.text;
}

function cachedRanges(a: string, b: string) {
  const key = `${a}\0${b}`;
  if (!cache.has(key)) {
    if (cache.size >= CACHE_PAIRS) cache.clear();
    cache.set(key, wordRanges(a, b));
  }
  return cache.get(key) ?? null;
}

/** Each line's changed character ranges by word, or null when the lines share too little for marks to help. */
function wordRanges(a: string, b: string): [Range[], Range[]] | null {
  const ops = wordOps(a, b);
  if (!ops) return null;
  const ra: Range[] = [];
  const rb: Range[] = [];
  let [pa, pb] = [0, 0];
  for (const { op, text } of ops) {
    if (op === "del") pa = mark(ra, a, pa, text.length);
    else if (op === "add") pb = mark(rb, b, pb, text.length);
    else [pa, pb] = [pa + text.length, pb + text.length];
  }
  return [trimmed(ra, a), trimmed(rb, b)];
}

type WordOp = { op: "same" | "del" | "add"; text: string };

/** Two lines as the words they share and the ones only one has, in order; null when they share too little. */
export function wordOps(a: string, b: string): WordOp[] | null {
  const x = a.match(WORDS) ?? [];
  const y = b.match(WORDS) ?? [];
  if (x.length * y.length > MAX_CELLS) return null;
  const ops = opsAlong(x, y);
  const same = ops
    .filter((o) => o.op === "same")
    .reduce((n, o) => n + o.text.trim().length, 0);
  const shorter = Math.min(a.trim().length, b.trim().length);
  return same === 0 || same * 2 < shorter ? null : ops;
}

// Both lines' words along their longest common run, neighbours of one kind joined.
function opsAlong(x: string[], y: string[]) {
  const lcs = lcsTable(x, y);
  const ops: WordOp[] = [];
  const push = (op: WordOp["op"], text: string) => {
    const last = ops.at(-1);
    if (last?.op === op) last.text += text;
    else ops.push({ op, text });
  };
  let [i, j] = [0, 0];
  while (i < x.length || j < y.length) {
    if (x[i] !== undefined && x[i] === y[j]) {
      push("same", x[i++]);
      j++;
    } else if (
      j >= y.length ||
      (i < x.length && lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      push("del", x[i++]);
    } else push("add", y[j++]);
  }
  return ops;
}

function trimmed(ranges: Range[], text: string): Range[] {
  return ranges
    .map(([start, end]): Range => {
      while (start < end && /\s/.test(text[start])) start++;
      while (end > start && /\s/.test(text[end - 1])) end--;
      return [start, end];
    })
    .filter(([start, end]) => start < end);
}

function lcsTable(x: string[], y: string[]) {
  const t = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      t[i][j] =
        x[i] === y[j]
          ? t[i + 1][j + 1] + 1
          : Math.max(t[i + 1][j], t[i][j + 1]);
  return t;
}

/** Adds a changed word to its line's ranges, joining one only whitespace keeps from the last. */
function mark(ranges: Range[], text: string, start: number, length: number) {
  const last = ranges.at(-1);
  if (last && text.slice(last[1], start).trim() === "")
    last[1] = start + length;
  else ranges.push([start, start + length]);
  return start + length;
}
