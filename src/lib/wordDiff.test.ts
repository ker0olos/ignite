import { describe, expect, it } from "vitest";
import { changedRanges, markTokens } from "@/lib/wordDiff";
import type { Token } from "@/lib/highlight";
import type { DiffLine } from "@/lib/toolRows";

const del = (text: string): DiffLine => ({ kind: "del", num: 1, text });
const add = (text: string): DiffLine => ({ kind: "add", num: 1, text });
const ctx = (text: string): DiffLine => ({ kind: "ctx", num: 1, text });

const slices = (text: string, ranges: [number, number][] | undefined) =>
  ranges?.map(([a, b]) => text.slice(a, b));

describe("changedRanges", () => {
  it("marks only the words that changed, joined across spaces", () => {
    const a =
      "or the result they described. A contested action simply failing does count.";
    const b =
      "or a detail of the result they described. A contested action failing outright does NOT count.";
    const ranges = changedRanges([del(a), add(b)]);
    expect(slices(a, ranges.get(0))).toEqual(["simply"]);
    expect(slices(b, ranges.get(1))).toEqual([
      "a detail of",
      "outright",
      "NOT",
    ]);
  });

  it("pairs removed lines with the added lines in the same place after them", () => {
    const ranges = changedRanges([
      ctx("x"),
      del("const a = 1;"),
      del("const b = 2;"),
      add("const a = 3;"),
      add("const b = 4;"),
      add("const c = 5;"),
    ]);
    expect(slices("const a = 1;", ranges.get(1))).toEqual(["1"]);
    expect(slices("const b = 4;", ranges.get(4))).toEqual(["4"]);
    expect(ranges.has(0)).toBe(false);
    expect(ranges.has(5)).toBe(false);
  });

  it("marks an emoji whole, not half of it", () => {
    const a = "status: 😀 done here ok";
    const b = "status: 😃 done here ok";
    const ranges = changedRanges([del(a), add(b)]);
    expect(slices(a, ranges.get(0))).toEqual(["😀"]);
    expect(slices(b, ranges.get(1))).toEqual(["😃"]);
  });

  it("marks non-English words whole", () => {
    const a = "título único aquí";
    const b = "título común aquí";
    expect(slices(b, changedRanges([del(a), add(b)]).get(1))).toEqual([
      "común",
    ]);
  });

  it("leaves lines that share too little unmarked", () => {
    expect(
      changedRanges([del("return foo(bar);"), add("const x = await y.z;")])
        .size,
    ).toBe(0);
  });

  it("leaves added lines with no removed ones unmarked", () => {
    expect(changedRanges([add("a b"), ctx("c"), del("d")]).size).toBe(0);
  });

  it("leaves very long lines unmarked", () => {
    const long = "a ".repeat(400);
    expect(changedRanges([del(long), add(long + "b")]).size).toBe(0);
  });
});

describe("markTokens", () => {
  it("cuts tokens at the ranges' edges", () => {
    const tokens: Token[] = [
      { content: "const ", style: { a: "1" } },
      { content: "value", style: { b: "2" } },
    ];
    expect(markTokens(tokens, [[3, 8]])).toEqual([
      { content: "con", style: { a: "1" }, changed: false },
      { content: "st ", style: { a: "1" }, changed: true },
      { content: "va", style: { b: "2" }, changed: true },
      { content: "lue", style: { b: "2" }, changed: false },
    ]);
  });

  it("keeps tokens whole with no ranges", () => {
    expect(markTokens([{ content: "x", style: {} }], [])).toEqual([
      { content: "x", style: {}, changed: false },
    ]);
  });
});
