import { describe, expect, it } from "vitest";
import { linkLabel, splitNotes } from "./noteLinks";

describe("linkLabel", () => {
  it("shortens GitHub issues and pull requests", () => {
    expect(linkLabel("https://github.com/ker0olos/tempo/issues/21")).toBe(
      "tempo#21",
    );
    expect(linkLabel("https://github.com/a/b/pull/3")).toBe("b#3");
  });
  it("uses host and path for other links", () => {
    expect(linkLabel("https://example.com/")).toBe("example.com");
    expect(linkLabel("https://example.com/docs/")).toBe("example.com/docs");
  });
  it("keeps what isn't a URL", () => {
    expect(linkLabel("http://")).toBe("http://");
  });
});

describe("splitNotes", () => {
  it("pulls links out and keeps the text", () => {
    expect(
      splitNotes("https://github.com/o/r/issues/1\nFix the chime."),
    ).toEqual({
      links: [{ url: "https://github.com/o/r/issues/1", label: "r#1" }],
      text: "Fix the chime.",
    });
  });
  it("handles notes with no links", () => {
    expect(splitNotes(" plain ")).toEqual({ links: [], text: "plain" });
  });
});
