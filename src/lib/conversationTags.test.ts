import { describe, expect, it } from "vitest";
import {
  addTags,
  normalizedTags,
  removeTag,
  splitTags,
  suggestionsFor,
  withTagsFor,
} from "./conversationTags";

describe("conversationTags", () => {
  it("normalizes: trims, dedupes, sorts case-insensitively", () => {
    expect(normalizedTags([" b ", "A", "b", ""])).toEqual(["A", "b"]);
  });

  it("splits pasted text at commas", () => {
    expect(splitTags("a, b,, a")).toEqual(["a", "b"]);
    expect(splitTags("  ")).toEqual([]);
  });

  it("adds and removes tags", () => {
    expect(addTags(["bug"], "design, bug")).toEqual(["bug", "design"]);
    expect(removeTag(["bug", "ui"], "bug")).toEqual(["ui"]);
  });

  it("suggests unused tags matching the typed text", () => {
    const all = ["bug", "Design", "later"];
    expect(suggestionsFor(all, ["bug"], "")).toEqual(["Design", "later"]);
    expect(suggestionsFor(all, ["bug"], "DES")).toEqual(["Design"]);
    expect(suggestionsFor(all, all, "")).toEqual([]);
  });

  it("saves a conversation's tags, dropping the entry when none are left", () => {
    expect(withTagsFor({ a: ["x"] }, "b", ["z", "y"])).toEqual({
      a: ["x"],
      b: ["y", "z"],
    });
    expect(withTagsFor({ a: ["x"] }, "a", [])).toEqual({});
  });
});
