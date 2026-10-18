import { describe, expect, it } from "vitest";
import {
  insertImageTags,
  insertMention,
  mentionAt,
  appCommand,
  mentionOptions,
  skillPrompt,
} from "./mentions";

const SKILLS = [
  { name: "code-review", description: "Review the diff" },
  { name: "release-notes", description: "Notes" },
];
const NONE = { skills: [], images: 0, terminals: [], files: [] };

describe("mentionAt", () => {
  it("finds a / only at the start of the message", () => {
    expect(mentionAt("/code", 5)).toEqual({
      trigger: "/",
      query: "code",
      start: 0,
      end: 5,
    });
    expect(mentionAt("run /code", 9)).toBeNull();
  });

  it("finds an @ after a space or the start, not inside a word", () => {
    expect(mentionAt("look at @t", 10)).toMatchObject({
      trigger: "@",
      query: "t",
      start: 8,
    });
    expect(mentionAt("@", 1)).toMatchObject({ query: "", start: 0 });
    expect(mentionAt("me@mail", 7)).toBeNull();
  });

  it("is null once the token ends or the caret is elsewhere", () => {
    expect(mentionAt("@src/a.ts ", 10)).toBeNull();
    expect(mentionAt("@src then", 9)).toBeNull();
    expect(mentionAt("@src then", 4)).toMatchObject({ query: "src" });
  });
});

describe("mentionOptions", () => {
  it("offers matching skills for /", () => {
    const options = mentionOptions(mentionAt("/rev", 4)!, {
      ...NONE,
      skills: SKILLS,
    });
    expect(options).toEqual([
      { kind: "skill", insert: "/code-review", detail: "Review the diff" },
    ]);
  });

  it("offers the app's commands before skills, over a skill of the same name", () => {
    const options = mentionOptions(mentionAt("/", 1)!, {
      ...NONE,
      skills: [...SKILLS, { name: "compact", description: "A skill" }],
    });
    expect(options.map((o) => [o.kind, o.insert])).toEqual([
      ["command", "/compact"],
      ["command", "/fork"],
      ["skill", "/code-review"],
      ["skill", "/release-notes"],
    ]);
  });

  it("offers images, terminals, then files for @", () => {
    const options = mentionOptions(mentionAt("@", 1)!, {
      skills: SKILLS,
      images: 2,
      terminals: ["t1"],
      files: [{ folder: "/p", path: "src/a.ts" }],
    });
    expect(options.map((o) => o.insert)).toEqual([
      "@image1",
      "@image2",
      "@t1",
      "@src/a.ts",
    ]);
  });

  it("names each image by its file, or as from the clipboard", () => {
    const options = mentionOptions(mentionAt("@im", 3)!, {
      ...NONE,
      images: 2,
      imageNames: ["shot.png", "Clipboard"],
    });
    expect(options).toEqual([
      { kind: "image", insert: "@image1", detail: "shot.png" },
      { kind: "image", insert: "@image2", detail: "Clipboard" },
    ]);
  });

  it("offers the message's attached files as @file1…, named, after its images", () => {
    const options = mentionOptions(mentionAt("@fi", 3)!, {
      ...NONE,
      images: 1,
      attached: ["report.pdf", "notes.txt"],
    });
    expect(options.slice(0, 2)).toEqual([
      { kind: "file", insert: "@file1", detail: "report.pdf" },
      { kind: "file", insert: "@file2", detail: "notes.txt" },
    ]);
  });

  it("filters images and terminals by what's typed, and keeps at most 8", () => {
    const options = mentionOptions(mentionAt("@t", 2)!, {
      ...NONE,
      images: 1,
      terminals: ["t1", "t2"],
      files: Array.from({ length: 10 }, (_, i) => ({
        folder: "/p",
        path: `t${i}.ts`,
      })),
    });
    expect(options.slice(0, 2).map((o) => o.insert)).toEqual(["@t1", "@t2"]);
    expect(options).toHaveLength(8);
  });
});

describe("insertMention", () => {
  it("replaces the token with a space after, the caret past it", () => {
    expect(
      insertMention("see @sr now", mentionAt("see @sr", 7)!, "@src/a.ts"),
    ).toEqual({ text: "see @src/a.ts now", caret: 14 });
    expect(insertMention("/co", mentionAt("/co", 3)!, "/code-review")).toEqual({
      text: "/code-review ",
      caret: 13,
    });
  });
});

describe("insertImageTags", () => {
  it("tags each pasted image at the caret, spaced from the text before", () => {
    expect(insertImageTags("look at this", 7, 7, 2, 2)).toEqual({
      text: "look at @image2 @image3 this",
      caret: 24,
    });
  });

  it("replaces the selection, adding no space at the start or after one", () => {
    expect(insertImageTags("x", 0, 1, 1, 1)).toEqual({
      text: "@image1 ",
      caret: 8,
    });
    expect(insertImageTags("see x", 4, 5, 1, 1).text).toBe("see @image1 ");
  });
});

describe("skillPrompt", () => {
  it("sends a known skill as pi's /skill: command", () => {
    expect(skillPrompt("/code-review src/", SKILLS)).toBe(
      "/skill:code-review src/",
    );
    expect(skillPrompt("/code-review", SKILLS)).toBe("/skill:code-review");
  });

  it("leaves the app's own commands to the app, over a skill of the same name", () => {
    const skills = [{ name: "compact", description: "A skill" }];
    expect(skillPrompt("/compact keep notes", skills)).toBe(
      "/compact keep notes",
    );
  });

  it("leaves other text alone", () => {
    expect(skillPrompt("/unknown x", SKILLS)).toBe("/unknown x");
    expect(skillPrompt("/Users/me/a.ts", SKILLS)).toBe("/Users/me/a.ts");
    expect(skillPrompt("fix it", SKILLS)).toBe("fix it");
  });
});

describe("appCommand", () => {
  it.each([
    ["/compact", ""],
    ["  /compact  ", ""],
    ["/compact keep the API notes", "keep the API notes"],
    ["/compact\nfocus on tests", "focus on tests"],
    ["/compaction", null],
    ["please /compact", null],
  ])("reads %j", (text, instructions) => {
    expect(appCommand("compact", text)).toBe(instructions);
  });

  it("reads /fork and its first message", () => {
    expect(appCommand("fork", "/fork run the benchmarks")).toBe(
      "run the benchmarks",
    );
    expect(appCommand("fork", "/compact x")).toBeNull();
  });
});
