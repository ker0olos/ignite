import { describe, expect, it } from "vitest";
import { quoteSource } from "./quote";

describe("quoteSource", () => {
  it("keeps the markdown and removes one level of >", () => {
    const md = "Reply:\n\n> - Fix **X**\n>\n> > nested\nlazy line\n\nAfter";
    expect(quoteSource(md, 8, md.indexOf("\n\nAfter"))).toBe(
      "- Fix **X**\n\n> nested\nlazy line",
    );
  });

  it("removes the indent of a quote inside a list", () => {
    expect(quoteSource("  > a\n  > b", 2, 11)).toBe("a\nb");
  });

  it("is empty without a position", () => {
    expect(quoteSource("> a")).toBe("");
  });
});
