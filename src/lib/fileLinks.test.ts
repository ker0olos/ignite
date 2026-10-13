import { describe, expect, it } from "vitest";
import {
  filePathTarget,
  isInsideFolder,
  looksLikeFilePath,
  splitPaths,
} from "./fileLinks";

describe("splitPaths", () => {
  it("picks out a command's paths, leaving quotes and punctuation as text", () => {
    expect(splitPaths("grep -E 'a|b' \"/tmp/x.log\";")).toEqual([
      { text: "grep" },
      { text: " " },
      { text: "-E" },
      { text: " " },
      { text: "'a|b'" },
      { text: " " },
      { text: '"' },
      { text: "/tmp/x.log", path: true },
      { text: '";' },
    ]);
  });

  it("keeps the text whole", () => {
    const text = "sleep 45; cat src/app.ts\n  | head";
    expect(
      splitPaths(text)
        .map((p) => p.text)
        .join(""),
    ).toBe(text);
  });
});

describe("file links", () => {
  it("recognizes common file references", () => {
    expect(looksLikeFilePath("tmp/core-user-tenets-notes.md")).toBe(true);
    expect(looksLikeFilePath("README.md")).toBe(true);
    expect(looksLikeFilePath("/Users/devon/dev/motr/tmp/notes.md")).toBe(true);
    expect(looksLikeFilePath("src/App.tsx:12")).toBe(true);
  });

  it("ignores ordinary inline code", () => {
    expect(looksLikeFilePath("npm run check")).toBe(false);
    expect(looksLikeFilePath("v0.2")).toBe(false);
    expect(looksLikeFilePath("https://example.com/file.md")).toBe(false);
  });

  it("resolves relative links from the open folder", () => {
    expect(filePathTarget("/repo", "tmp/notes.md")).toBe("/repo/tmp/notes.md");
    expect(filePathTarget("/repo/app", "../README.md:3")).toBe(
      "/repo/README.md",
    );
    expect(filePathTarget("/repo", "file:///repo/notes.md")).toBe(
      "/repo/notes.md",
    );
  });

  it("detects whether a resolved file is inside the open folder", () => {
    expect(isInsideFolder("/repo", "/repo/tmp/notes.md")).toBe(true);
    expect(isInsideFolder("/repo", "/repo-other/tmp/notes.md")).toBe(false);
  });
});
