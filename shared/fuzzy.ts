/**
 * How well `query` matches `text`, higher is better; null when it doesn't.
 * Every query character must appear in order. A contiguous match beats a
 * scattered one, a match at a word start beats one inside a word, and a
 * shorter text beats a longer one (so `app.ts` beats `apps/lib/app-tests.ts`).
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  const at = t.indexOf(q);
  if (at !== -1) {
    const wordStart = at === 0 || /[\s/._-]/.test(t[at - 1]);
    return 1000 + (wordStart ? 200 : 0) - at - t.length / 100;
  }
  let score = 0;
  let from = 0;
  let last = -2;
  for (const c of q) {
    const i = t.indexOf(c, from);
    if (i === -1) return null;
    const wordStart = i === 0 || /[\s/._-]/.test(t[i - 1]);
    score += (i === last + 1 ? 5 : 0) + (wordStart ? 3 : 0) - (i - from) / 10;
    last = i;
    from = i + 1;
  }
  return score - t.length / 100;
}

/** Where `query` matched `path`, as the search ranks files: in its name if it can, else anywhere in it. */
export function pathRanges(query: string, path: string): [number, number][] {
  const cut = path.lastIndexOf("/") + 1;
  const inName = matchRanges(query, path.slice(cut), true);
  return inName.length
    ? inName.map(([s, e]) => [s + cut, e + cut])
    : matchRanges(query, path, true);
}

/**
 * Where `query` shows in `text`, as [start, end) ranges: every place it
 * appears as typed, else (when `fuzzy`) the scattered characters
 * `fuzzyScore` matched.
 */
export function matchRanges(
  query: string,
  text: string,
  fuzzy = false,
): [number, number][] {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return [];
  const ranges: [number, number][] = [];
  for (let at = t.indexOf(q); at !== -1; at = t.indexOf(q, at + q.length)) {
    ranges.push([at, at + q.length]);
  }
  if (ranges.length || !fuzzy || fuzzyScore(q, t) === null) return ranges;
  let from = 0;
  for (const c of q) {
    const i = t.indexOf(c, from);
    const prev = ranges.at(-1);
    if (prev?.[1] === i) prev[1] = i + 1;
    else ranges.push([i, i + 1]);
    from = i + 1;
  }
  return ranges;
}
