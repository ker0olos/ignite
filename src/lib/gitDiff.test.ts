import { describe, expect, it } from "vitest";
import {
  changeStarts,
  nextChange,
  parseUnifiedDiff,
  withoutDiffstat,
} from "./gitDiff";

describe("parseUnifiedDiff", () => {
  it("returns nothing for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });

  it("skips header lines and numbers hunks from their @@ line", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "index abc123..def456 100644",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,3 +1,4 @@",
      " first",
      "-second",
      "+second, edited",
      "+third",
      " fourth",
    ].join("\n");

    expect(parseUnifiedDiff(diff)).toEqual([
      { kind: "ctx", num: 1, text: "first" },
      { kind: "del", num: 2, text: "second" },
      { kind: "add", num: 2, text: "second, edited" },
      { kind: "add", num: 3, text: "third" },
      { kind: "ctx", num: 4, text: "fourth" },
    ]);
  });

  it("gaps between hunks, but not before the first", () => {
    const diff = [
      "@@ -1,2 +1,2 @@",
      " a",
      "-b",
      "+b2",
      "@@ -10,2 +10,2 @@",
      " j",
      "-k",
      "+k2",
    ].join("\n");

    const lines = parseUnifiedDiff(diff);
    expect(lines[0]).toEqual({ kind: "ctx", num: 1, text: "a" });
    expect(lines[3]).toEqual({ kind: "gap" });
    expect(lines[4]).toEqual({ kind: "ctx", num: 10, text: "j" });
  });

  it("skips a 'No newline at end of file' marker", () => {
    const diff = [
      "@@ -1 +1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
    ].join("\n");
    expect(parseUnifiedDiff(diff)).toEqual([
      { kind: "del", num: 1, text: "old" },
      { kind: "add", num: 1, text: "new" },
    ]);
  });
});

describe("changeStarts and nextChange", () => {
  const ctx = { kind: "ctx", num: 1, text: "" } as const;
  const add = { kind: "add", num: 1, text: "" } as const;
  const del = { kind: "del", num: 1, text: "" } as const;
  const lines = [ctx, del, add, ctx, ctx, add, ctx];

  it("finds where each run of changes starts", () => {
    expect(changeStarts(lines)).toEqual([1, 5]);
    expect(changeStarts([ctx])).toEqual([]);
  });

  it("steps through changes and wraps around", () => {
    const starts = changeStarts(lines);
    expect(nextChange(starts, 1, 1)).toBe(5);
    expect(nextChange(starts, 5, 1)).toBe(1);
    expect(nextChange(starts, 5, -1)).toBe(1);
    expect(nextChange(starts, 1, -1)).toBe(5);
    expect(nextChange([], 0, 1)).toBeUndefined();
  });
});

describe("withoutDiffstat", () => {
  it("keeps git's messages and drops the per-file stats", () => {
    const output = [
      "Updating d1e54d6..8197447",
      "Fast-forward",
      " .rulesync/rules/DATES.md    |  2 +",
      " assets/logo.png             | Bin 0 -> 12 bytes",
      " 2 files changed, 2 insertions(+)",
      " create mode 100644 assets/logo.png",
    ].join("\n");
    expect(withoutDiffstat(output)).toBe(
      "Updating d1e54d6..8197447\nFast-forward",
    );
  });
});
