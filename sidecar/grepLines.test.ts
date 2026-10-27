import { expect, it } from "vitest";
import { lineParts } from "./grepLines.ts";

it("splits a pattern at its line breaks", () => {
  expect(lineParts("a\\n\\s*b", false)).toEqual(["a", "\\s*b"]);
  expect(lineParts("a\nb", true)).toEqual(["a", "b"]);
  expect(lineParts("a\\n", false)).toBeUndefined();
});

it("leaves one-line patterns, escaped backslashes and split groups to ripgrep", () => {
  expect(lineParts("plain", false)).toBeUndefined();
  expect(lineParts("a\\\\nb", false)).toBeUndefined();
  expect(lineParts("(a\\nb)", false)).toBeUndefined();
  expect(lineParts("\\nb", false)).toBeUndefined();
});
