import type { DiffLine } from "@/lib/toolRows";

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Parses a unified diff (as `git diff -U100000` prints) into highlighted lines, gapped between hunks. */
export function parseUnifiedDiff(text: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNum = 0;
  let newNum = 0;
  let inHunk = false;

  for (const line of text.split("\n")) {
    const hunk = HUNK.exec(line);
    if (hunk) {
      if (inHunk) lines.push({ kind: "gap" });
      oldNum = Number(hunk[1]);
      newNum = Number(hunk[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue;

    const marker = line[0];
    const content = line.slice(1);
    if (marker === "+")
      lines.push({ kind: "add", num: newNum++, text: content });
    else if (marker === "-")
      lines.push({ kind: "del", num: oldNum++, text: content });
    else if (marker === " ") {
      lines.push({ kind: "ctx", num: newNum, text: content });
      oldNum++;
      newNum++;
    }
  }
  return lines;
}

const isChange = (line: DiffLine | undefined) =>
  line?.kind === "add" || line?.kind === "del";

export type DiffRow = { index: number } | { from: number; to: number };

const CONTEXT = 3;

/** Rows to show: unchanged lines more than 3 from a change folded, as VS Code does, unless expanded (by fold start). */
export function foldUnchanged(
  lines: DiffLine[],
  expanded: ReadonlySet<number>,
): DiffRow[] {
  const changed = lines.some(isChange);
  const near = lines.map(() => !changed);
  lines.forEach((line, i) => {
    if (line.kind === "ctx") return;
    const last = Math.min(lines.length - 1, i + CONTEXT);
    for (let j = Math.max(0, i - CONTEXT); j <= last; j++) near[j] = true;
  });
  const rows: DiffRow[] = [];
  for (let i = 0; i < lines.length;) {
    let end = i;
    while (end < lines.length && !near[end]) end++;
    if (end - i > CONTEXT && !expanded.has(i)) {
      rows.push({ from: i, to: end });
      i = end;
    } else {
      const stop = Math.max(end, i + 1);
      for (; i < stop; i++) rows.push({ index: i });
    }
  }
  return rows;
}

/** The row where each run of added or removed lines starts. */
export function changeStarts(lines: DiffLine[]): number[] {
  return lines.flatMap((line, i) =>
    isChange(line) && !isChange(lines[i - 1]) ? [i] : [],
  );
}

/** The change after (`step` 1) or before (-1) row `from`, wrapping around as VS Code does. */
export function nextChange(
  starts: number[],
  from: number,
  step: 1 | -1,
): number | undefined {
  if (step === 1) return starts.find((s) => s > from) ?? starts[0];
  return starts.findLast((s) => s < from) ?? starts.at(-1);
}

// `path | 14 +-` and `1 file changed, 2 insertions(+)`, which a changes card shows better.
const DIFFSTAT =
  /^\s+\S.*\|\s+(?:\d+|Bin\b)|^\s*\d+ files? changed|^\s+(?:create|delete) mode \d+ /;

/** git's output without its diffstat lines. */
export function withoutDiffstat(text: string): string {
  return text
    .split("\n")
    .filter((line) => !DIFFSTAT.test(line))
    .join("\n")
    .trim();
}
