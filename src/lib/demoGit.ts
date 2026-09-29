/**
 * The demo's git: what its commits change, as the review cards list them and
 * as `git_diff` shows them when a file is opened from one.
 */
import type { GitChange, GitReview } from "../../shared/git";
import { parseDiff } from "./toolRows";

/** A unified diff (what `git_diff` returns) from an edit diff in pi's format. */
export function unifiedDiff(piDiff: string): string {
  const out: string[] = [];
  let shift = 0;
  let start = true;
  for (const line of parseDiff(piDiff)) {
    if (line.kind === "gap") {
      start = true;
      continue;
    }
    if (start) {
      const newNum = line.kind === "del" ? line.num + shift : line.num;
      out.push(`@@ -${newNum - shift} +${newNum} @@`);
      start = false;
    }
    const mark = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
    out.push(`${mark}${line.text}`);
    if (line.kind === "add") shift++;
    if (line.kind === "del") shift--;
  }
  return out.join("\n");
}

/** A new file's unified diff: every line added. */
export function addedFile(content: string): string {
  const lines = content.replace(/\n$/, "").split("\n");
  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join(
    "\n",
  );
}

// A file's review line, counted from its unified diff.
function changeOf(path: string, diff: string): GitChange {
  const lines = diff.split("\n");
  const added = lines.filter((l) => l.startsWith("+")).length;
  const removed = lines.filter((l) => l.startsWith("-")).length;
  return {
    path,
    status: diff.startsWith("@@ -0,0") ? "A" : "M",
    added,
    removed,
  };
}

/** What committing `diffs` in `repo` shows for review. */
export const commitReview = (
  repo: string,
  diffs: Record<string, string>,
  message: string,
): GitReview => ({
  kind: "commit",
  repo,
  range: "staged",
  files: Object.entries(diffs).map(([path, diff]) => changeOf(path, diff)),
  message,
});
