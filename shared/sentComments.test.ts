import { describe, expect, it } from "vitest";
import {
  commentPlace,
  readComments,
  typedMessage,
  withComments,
  type CommentLine,
  type SentComment,
} from "./sentComments.ts";

// Old lines 10-12 became new lines 10-11: 10 kept, 11 removed, 11 added, 12 removed.
const lines: CommentLine[] = [
  { kind: "ctx", num: 10, text: "const a = 1;" },
  { kind: "del", num: 11, text: "const b = 2;" },
  { kind: "add", num: 11, text: "const b = 3;" },
  { kind: "del", num: 12, text: "const c = 4;" },
];
const comment: SentComment = {
  path: "src/app.ts",
  lines,
  text: "  Why change b?  ",
};

describe("commentPlace", () => {
  it("names one line, or a range, by the new file's numbers", () => {
    expect(commentPlace("a.ts", lines.slice(0, 1))).toBe("a.ts:10");
    expect(commentPlace("a.ts", lines)).toBe("a.ts:10-11");
  });

  it("uses the old file's numbers when every line was removed", () => {
    expect(commentPlace("a.ts", [lines[1], lines[3]])).toBe(
      "a.ts:11-12 (removed)",
    );
  });
});

describe("withComments", () => {
  it("adds each comment as an @mention, its quoted lines (removed ones marked) and the comment", () => {
    expect(withComments("Look at these", [comment])).toBe(
      [
        "Look at these",
        "",
        "<diff_comments>",
        "The user's comments on lines of a diff, each after the lines it's on:",
        "",
        "@src/app.ts:10-11",
        "```",
        "10          const a = 1;",
        "11 removed  const b = 2;",
        "11 added    const b = 3;",
        "12 removed  const c = 4;",
        "```",
        "Why change b?",
        "</diff_comments>",
      ].join("\n"),
    );
  });

  it("leaves a message without comments as it is, and sends comments alone", () => {
    expect(withComments("Hi", [])).toBe("Hi");
    expect(withComments("  ", [comment])).toMatch(/^<diff_comments>\n/);
  });

  it("pads numbers to the widest, and fences backticks with a longer fence", () => {
    const sent = withComments("", [
      {
        path: "a.ts",
        lines: [
          { kind: "ctx", num: 9, text: "x" },
          { kind: "ctx", num: 10, text: "s = ```code```" },
        ],
        text: "Note",
      },
    ]);
    expect(sent).toContain(
      "\n````\n 9          x\n10          s = ```code```\n````\n",
    );
  });
});

describe("readComments", () => {
  it("reads back the text and every comment, in order", () => {
    const second: SentComment = {
      path: "b.ts",
      lines: [{ kind: "add", num: 3, text: "new();" }],
      text: "Two\nlines",
    };
    expect(readComments(withComments("Look", [comment, second]))).toEqual({
      text: "Look",
      comments: [{ ...comment, text: "Why change b?" }, second],
    });
  });

  it("leaves a message that carries none, or a broken block, as it is", () => {
    expect(readComments("Just text")).toEqual({
      text: "Just text",
      comments: [],
    });
    const broken = withComments("Look", [comment]).replace(
      "11 added",
      "eleven",
    );
    expect(readComments(broken)).toEqual({ text: broken, comments: [] });
    const unclosed = withComments("Look", [comment]).replace(/```\nWhy/, "Why");
    expect(readComments(unclosed).comments).toEqual([]);
  });
});

describe("typedMessage", () => {
  it("leaves the comments out of what the user wrote, a skill as its /name", () => {
    const skill = '<skill name="review" location="/s">\nBody\n</skill>\n\nnow';
    expect(typedMessage(withComments(skill, [comment]))).toBe("/review now");
  });

  it("names the comments when they're all the message has", () => {
    expect(typedMessage(withComments("", [comment]))).toBe(
      "1 comment on src/app.ts",
    );
    expect(typedMessage(withComments("", [comment, comment]))).toBe(
      "2 comments on src/app.ts",
    );
    expect(typedMessage("")).toBe("");
  });
});
