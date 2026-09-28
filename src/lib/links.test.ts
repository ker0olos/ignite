import { describe, expect, it } from "vitest";
import { splitLinks } from "./links";

describe("splitLinks", () => {
  it("finds URLs, leaving trailing punctuation out", () => {
    expect(
      splitLinks(
        "PR: https://github.com/o/r/pull/658. Done (see https://x.dev/a?b=1)",
      ),
    ).toEqual([
      { text: "PR: " },
      { text: "https://github.com/o/r/pull/658", url: true },
      { text: ". Done (see " },
      { text: "https://x.dev/a?b=1", url: true },
      { text: ")" },
    ]);
  });

  it("leaves text without URLs whole", () => {
    expect(splitLinks("no links")).toEqual([{ text: "no links" }]);
    expect(splitLinks("")).toEqual([]);
  });
});
