import { describe, expect, it } from "vitest";
import { readFiles, withFiles, type SentFile } from "./attachedFiles.ts";

const notes: SentFile = {
  path: "/d/notes.txt",
  text: "line one\n\nline three",
};
const pdf: SentFile = { path: "/d/my report.pdf" };

describe("withFiles", () => {
  it("adds each file as an @mention, its text inline or only its path", () => {
    expect(withFiles("Look", [notes, pdf])).toBe(
      [
        "Look",
        "",
        "<attached_files>",
        "Files the user attached:",
        "",
        "@file1: /d/notes.txt",
        "```",
        "line one",
        "",
        "line three",
        "```",
        "",
        "@file2: /d/my report.pdf (open it with your tools)",
        "</attached_files>",
      ].join("\n"),
    );
  });

  it("leaves a message without files as it is, and sends files alone", () => {
    expect(withFiles("Hi", [])).toBe("Hi");
    expect(withFiles(" ", [pdf])).toMatch(/^<attached_files>\n/);
  });

  it("fences text holding backticks with a longer fence", () => {
    const code = { path: "/d/a.md", text: "```js\nx()\n```" };
    expect(withFiles("", [code])).toContain("\n````\n```js");
    expect(readFiles(withFiles("", [code])).files).toEqual([code]);
  });
});

describe("readFiles", () => {
  it("reads back the text and every file, in order", () => {
    expect(readFiles(withFiles("Look", [notes, pdf]))).toEqual({
      text: "Look",
      files: [notes, pdf],
    });
  });

  it("leaves a message that carries none, or a broken block, as it is", () => {
    expect(readFiles("Just text")).toEqual({ text: "Just text", files: [] });
    const broken = withFiles("Look", [notes]).replace("@file1: ", "@");
    expect(readFiles(broken)).toEqual({ text: broken, files: [] });
    const unclosed = withFiles("Look", [notes]).replace(
      /```\n<\/attached/,
      "</attached",
    );
    expect(readFiles(unclosed).files).toEqual([]);
  });
});
