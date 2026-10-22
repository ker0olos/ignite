import { describe, expect, it } from "vitest";
import { argAt, argChoices, commandArgs } from "./commandArgs";

const REVIEW = {
  name: "code-review",
  description: "Review",
  argumentHint: "[low|medium|high] [target]",
};
const COMMANDS = [REVIEW, { name: "plain", description: "No arguments" }];
const at = (text: string, caret = text.length) => argAt(text, caret, COMMANDS);

describe("commandArgs", () => {
  it("reads optional, required and bare arguments, and fixed values", () => {
    expect(
      commandArgs({
        argumentHint: "[low | high] <pr number> path",
        argumentDescriptions: ["How hard", ""],
      }),
    ).toEqual([
      {
        name: "low | high",
        optional: true,
        choices: ["low", "high"],
        description: "How hard",
      },
      { name: "pr number", optional: false },
      { name: "path", optional: false },
    ]);
    expect(commandArgs({})).toEqual([]);
  });
});

describe("argAt", () => {
  it("finds the argument the caret is in, and what's typed of it", () => {
    expect(at("/code-review ")).toMatchObject({
      name: "code-review",
      index: 0,
      query: "",
      start: 13,
    });
    expect(at("/code-review low src")).toMatchObject({
      index: 1,
      query: "src",
      start: 17,
      end: 20,
    });
  });

  it("skips an optional fixed value the word isn't, and stays on the last", () => {
    expect(at("/code-review src/ ")).toMatchObject({ index: 1, query: "" });
    // Still typing: no value starts with "main", so it's the target already.
    expect(at("/code-review main")).toMatchObject({ index: 1, query: "main" });
    expect(at("/code-review lo")).toMatchObject({ index: 0 });
    // Values match in any case.
    expect(at("/code-review High main")).toMatchObject({ index: 1 });
    expect(at("/code-review low a b c")).toMatchObject({
      index: 1,
      query: "c",
    });
  });

  it("is null outside a known command's arguments", () => {
    expect(at("/code-review")).toBeNull();
    expect(at("/code-review low", 5)).toBeNull();
    expect(at("/plain x")).toBeNull();
    expect(at("/other x")).toBeNull();
    expect(at("/code-review low\nmore")).toBeNull();
    expect(at("review low")).toBeNull();
  });
});

describe("argChoices", () => {
  it("offers the values that start with what's typed, not one typed in full", () => {
    expect(argChoices(at("/code-review M")!)).toEqual(["medium"]);
    expect(argChoices(at("/code-review high")!)).toEqual([]);
    expect(argChoices(at("/code-review HIGH")!)).toEqual([]);
  });

  it("offers every value before one is typed, none for a free argument", () => {
    expect(argChoices(at("/code-review ")!)).toEqual(["low", "medium", "high"]);
    expect(argChoices(at("/code-review low ")!)).toEqual([]);
  });
});
