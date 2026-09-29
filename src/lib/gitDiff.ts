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
