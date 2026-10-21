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
  const x = a.match(WORDS) ?? [];
  const y = b.match(WORDS) ?? [];
  if (x.length * y.length > MAX_CELLS) return null;
  const { ra, rb, same } = walk(a, b, x, y);
  const shorter = Math.min(a.trim().length, b.trim().length);
  if (same === 0 || same * 2 < shorter) return null;
  return [trimmed(ra, a), trimmed(rb, b)];
}

/** Steps through both lines' words along their longest common run, marking the rest; `same` counts the shared text. */
function walk(a: string, b: string, x: string[], y: string[]) {
  const lcs = lcsTable(x, y);
  const ra: Range[] = [];
  const rb: Range[] = [];
  let [i, j, pa, pb, same] = [0, 0, 0, 0, 0];
  while (i < x.length || j < y.length) {
    if (x[i] !== undefined && x[i] === y[j]) {
      same += x[i].trim().length;
      pa += x[i++].length;
      pb += y[j++].length;
    } else if (
      j >= y.length ||
      (i < x.length && lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      pa = mark(ra, a, pa, x[i++].length);
    } else {
      pb = mark(rb, b, pb, y[j++].length);
    }
  }
  return { ra, rb, same };
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
