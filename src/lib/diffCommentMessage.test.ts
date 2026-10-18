import { describe, expect, it } from "vitest";
import type { DiffComment } from "@/lib/diffComments";
import {
  appendToDraft,
  commentLines,
  commentPlace,
  commentsMessage,
} from "@/lib/diffCommentMessage";
import type { DiffLine } from "@/lib/toolRows";

// Old lines 10-12 became new lines 10-11: 10 kept, 11 removed, 11 added, 12 removed.
const lines: DiffLine[] = [
  { kind: "ctx", num: 10, text: "const a = 1;" },
  { kind: "del", num: 11, text: "const b = 2;" },
  { kind: "add", num: 11, text: "const b = 3;" },
  { kind: "del", num: 12, text: "const c = 4;" },
  { kind: "gap" },
  { kind: "ctx", num: 40, text: "end();" },
];

const comment = (over: Partial<DiffComment>): DiffComment => ({
  id: 1,
  repo: "/repo",
  path: "src/app.ts",
  range: "HEAD",
  from: 0,
  to: 0,
  lines: commentLines(lines, over.from ?? 0, over.to ?? 0),
  text: "Note",
  ...over,
});

describe("commentLines", () => {
  it("takes the rows in either order and leaves gaps out", () => {
    expect(commentLines(lines, 5, 3).map((l) => l.num)).toEqual([12, 40]);
    expect(commentLines(lines, 1, 1)).toEqual([lines[1]]);
  });
});

describe("commentPlace", () => {
  it("names one line, or a range, by the new file's numbers", () => {
    expect(commentPlace("a.ts", commentLines(lines, 0, 0))).toBe("a.ts:10");
    expect(commentPlace("a.ts", commentLines(lines, 0, 3))).toBe("a.ts:10-11");
  });

  it("uses the old file's numbers when every line was removed", () => {
    expect(commentPlace("a.ts", commentLines(lines, 1, 1))).toBe(
      "a.ts:11 (removed)",
    );
  });
});

describe("commentsMessage", () => {
  it("quotes the lines with their numbers, marking added and removed ones", () => {
    const message = commentsMessage([
      comment({ from: 0, to: 3, text: "  Why change b?  " }),
    ]);
    expect(message).toBe(
      [
        "src/app.ts:10-11",
        "```",
        "10          const a = 1;",
        "11 removed  const b = 2;",
        "11 added    const b = 3;",
        "12 removed  const c = 4;",
        "```",
        "Why change b?",
      ].join("\n"),
    );
  });

  it("orders blocks by repository, file and line, whatever the order added", () => {
    const message = commentsMessage([
      comment({ id: 1, path: "src/b.ts", text: "B" }),
      comment({ id: 2, from: 5, to: 5, text: "A late" }),
      comment({ id: 3, text: "A early" }),
      comment({ id: 4, repo: "/other", path: "z.ts", text: "Other repo" }),
    ]);
    const order = ["Other repo", "A early", "A late", "B"];
    const at = order.map((t) => message.indexOf(`\n${t}`));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(message.split("\n\n")).toHaveLength(4);
  });

  it("fences lines holding backticks with a longer fence", () => {
    const fenced = commentsMessage([
      comment({
        lines: [{ kind: "ctx", num: 1, text: "s = ```code```" }],
      }),
    ]);
    expect(fenced.split("\n")[1]).toBe("````");
  });

  it("pads numbers to the widest", () => {
    const message = commentsMessage([comment({ from: 3, to: 5 })]);
    expect(message).toContain("\n12 removed  const c = 4;\n40          end();");
    const short = commentsMessage([
      comment({
        lines: [
          { kind: "ctx", num: 9, text: "x" },
          { kind: "ctx", num: 10, text: "y" },
        ],
      }),
    ]);
    expect(short).toContain("\n 9          x\n10          y");
  });
});

describe("appendToDraft", () => {
  it("puts a blank line after a draft, and nothing before an empty one", () => {
    expect(appendToDraft("", "added")).toBe("added");
    expect(appendToDraft("Look at these\n", "added")).toBe(
      "Look at these\n\nadded",
    );
  });
});
