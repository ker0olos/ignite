import { describe, expect, it } from "vitest";
import type { DiffComment } from "@/lib/diffComments";
import {
  commentLines,
  placeComment,
  sentComments,
} from "@/lib/diffCommentMessage";
import type { DiffLine } from "@/lib/toolRows";

const lines: DiffLine[] = [
  { kind: "ctx", num: 10, text: "a" },
  { kind: "del", num: 11, text: "b" },
  { kind: "gap" },
  { kind: "add", num: 40, text: "c" },
];

const comment = (over: Partial<DiffComment>): DiffComment => ({
  id: 1,
  diff: { repo: "/repo", range: "HEAD", status: "M" },
  path: "src/a.ts",
  from: 0,
  to: 0,
  lines: [],
  text: "Note",
  ...over,
});

describe("commentLines", () => {
  it("takes the rows in either order, each with its own number, gaps left out", () => {
    expect(commentLines(lines, 3, 1)).toEqual([lines[1], lines[3]]);
    expect(commentLines(lines, 0, 0)).toEqual([lines[0]]);
  });
});

describe("sentComments", () => {
  it("orders by repository, file and line, whatever the order added", () => {
    const sent = sentComments([
      comment({ id: 1, path: "src/b.ts", text: "B" }),
      comment({ id: 2, from: 5, to: 5, text: "A late" }),
      comment({ id: 3, from: 2, to: 0, text: "A early" }),
      comment({ id: 4, diff: undefined, path: "z.ts", text: "Taken back" }),
    ]);
    expect(sent.map((c) => c.text)).toEqual([
      "Taken back",
      "A early",
      "A late",
      "B",
    ]);
    expect(sent[0]).toEqual({ path: "z.ts", lines: [], text: "Taken back" });
  });
});

describe("placeComment", () => {
  const at = (from: number, to: number) =>
    comment({ from, to, lines: commentLines(lines, from, to) });

  it("keeps a comment at its rows while they still hold its lines", () => {
    expect(placeComment(lines, at(0, 1))).toMatchObject({ from: 0, to: 1 });
  });

  it("follows its lines to where the diff, read again, has them, nearest first", () => {
    const moved: DiffLine[] = [
      { kind: "ctx", num: 9, text: "new" },
      ...lines,
      { kind: "ctx", num: 50, text: "a" },
    ];
    expect(placeComment(moved, at(0, 1))).toMatchObject({ from: 1, to: 2 });
    expect(placeComment(moved, at(3, 3))).toMatchObject({ from: 4, to: 4 });
  });

  it("finds no place once its lines are gone", () => {
    expect(
      placeComment([{ kind: "ctx", num: 1, text: "z" }], at(0, 1)),
    ).toBeNull();
  });
});
