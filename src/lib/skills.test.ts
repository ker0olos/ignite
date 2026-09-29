import { expect, it } from "vitest";
import { countOf, firstSentence } from "./skills";

it("keeps a description's first sentence, or all of one without a stop", () => {
  expect(firstSentence("Builds apps. Use when shipping.")).toBe("Builds apps.");
  expect(firstSentence("Reads v1.2 files. More.")).toBe("Reads v1.2 files.");
  expect(firstSentence("No stop here")).toBe("No stop here");
});

it("counts in the singular only for one", () => {
  expect([0, 1, 2].map((n) => countOf(n, "skill"))).toEqual([
    "0 skills",
    "1 skill",
    "2 skills",
  ]);
});
