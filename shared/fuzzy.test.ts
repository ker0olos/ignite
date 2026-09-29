import { describe, expect, it } from "vitest";
import { fuzzyScore, matchRanges, pathRanges } from "./fuzzy.ts";

const rank = (query: string, texts: string[]) =>
  texts
    .map((t) => [t, fuzzyScore(query, t)] as const)
    .filter(([, s]) => s !== null)
    .sort((a, b) => b[1]! - a[1]!)
    .map(([t]) => t);

describe("fuzzyScore", () => {
  it("needs every character, in order", () => {
    expect(fuzzyScore("abc", "a-b-c")).not.toBeNull();
    expect(fuzzyScore("abc", "cba")).toBeNull();
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("ranks contiguous and word-start matches first, then shorter texts", () => {
    expect(
      rank("app", [
        "src/lib/mapping.ts",
        "apps/lib/app-tests.ts",
        "app.ts",
        "a-p-p.md",
      ]),
    ).toEqual([
      "app.ts",
      "apps/lib/app-tests.ts",
      "src/lib/mapping.ts",
      "a-p-p.md",
    ]);
  });

  it("ignores case", () => {
    expect(fuzzyScore("SENTRY", "check the sentry errors")).not.toBeNull();
  });
});

describe("matchRanges", () => {
  it("finds every place the query appears as typed, in any case", () => {
    expect(matchRanges("in", "Index in main")).toEqual([
      [0, 2],
      [6, 8],
      [11, 13],
    ]);
  });

  it("marks scattered characters only when fuzzy, merging neighbours", () => {
    expect(matchRanges("mnts", "main.ts")).toEqual([]);
    expect(matchRanges("mnts", "main.ts", true)).toEqual([
      [0, 1],
      [3, 4],
      [5, 7],
    ]);
  });

  it("marks a path in its name when it can, else across its folders", () => {
    expect(pathRanges("idx", "src/index.ts")).toEqual([
      [4, 5],
      [6, 7],
      [8, 9],
    ]);
    expect(pathRanges("schema/index", "db/schema/index.ts")).toEqual([[3, 15]]);
  });

  it("marks nothing for no query or no match", () => {
    expect(matchRanges("", "text", true)).toEqual([]);
    expect(matchRanges("zz", "text", true)).toEqual([]);
  });
});
