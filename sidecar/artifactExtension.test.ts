import { describe, expect, it } from "vitest";
import { emptyPages } from "./artifactExtension.ts";

describe("emptyPages", () => {
  it("accepts pages that each have html or markdown", () => {
    expect(
      emptyPages([
        { title: "A", html: "<p>a</p>" },
        { title: "B", markdown: "" },
      ]),
    ).toBeUndefined();
  });

  it("names the pages with neither", () => {
    expect(
      emptyPages([
        { title: "A", html: "<p>a</p>" },
        { title: "B" },
        { title: "C" },
      ]),
    ).toMatch(/^Nothing shown: "B", "C" has no/);
  });
});
