// @vitest-environment node
import { expect, it } from "vitest";
import { numbered, prepareRead } from "./readSections.ts";

it("turns ranges written as text into offset and limit", () => {
  expect(prepareRead({ path: "a", offset: "[310, 330]", limit: 5 })).toEqual({
    path: "a",
    offset: 310,
    limit: 21,
  });
  expect(prepareRead({ path: "a", offset: "12" })).toEqual({
    path: "a",
    offset: 12,
  });
  expect(prepareRead({ path: "a", offset: "soon" })).toEqual({
    path: "a",
    offset: "soon",
  });
});

it("parses an also sent as a JSON string, fixing its ranges", () => {
  expect(
    prepareRead({ path: "a", also: '[{"path":"b","offset":"4-5"}, 3]' }),
  ).toEqual({ path: "a", also: [{ path: "b", offset: 4, limit: 2 }, 3] });
  expect(prepareRead({ path: "a", also: "{oops" })).toEqual({
    path: "a",
    also: "{oops",
  });
  expect(prepareRead(null)).toBeNull();
});

it("numbers lines from the first, leaving pi's notes alone", () => {
  expect(numbered("a\nb", 7)).toBe("7\ta\n8\tb");
  expect(numbered("a\n", 1)).toBe("1\ta\n");
  expect(
    numbered("a\n\n\n[2 more lines in file. Use offset=3 to continue.]", 1),
  ).toBe("1\ta\n2\t\n\n[2 more lines in file. Use offset=3 to continue.]");
  expect(
    numbered("a\nb\n\n[3 more lines in file. Use offset=3 to continue.]", 1),
  ).toBe("1\ta\n2\tb\n\n[3 more lines in file. Use offset=3 to continue.]");
  const huge = "[Line 4 is 60KB, exceeds 50KB limit. Use bash: sed]";
  expect(numbered(huge, 4)).toBe(huge);
});
