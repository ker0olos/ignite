import { describe, expect, it } from "vitest";
import { brokenPages, emptyPages } from "./artifactExtension.ts";

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

describe("brokenPages", () => {
  it("passes when no HTML page has errors", async () => {
    const errorsOf = async () => [];
    expect(
      await brokenPages([{ title: "A", html: "<p>a</p>" }], errorsOf),
    ).toBeUndefined();
  });

  it("lists each failing page's errors and skips markdown", async () => {
    const errorsOf = async (html: string) =>
      html.includes("top") ? ["SyntaxError: top (line 3)"] : [];
    const error = await brokenPages(
      [
        { title: "A", html: "<script>const top=1</script>" },
        { title: "B", html: "<p>b</p>" },
        { title: "C", markdown: "top" },
      ],
      errorsOf,
    );
    expect(error).toMatch(/^Nothing shown: these pages fail in a browser/);
    expect(error).toContain('"A":\n- SyntaxError: top (line 3)');
    expect(error).not.toContain('"B"');
    expect(error).not.toContain('"C"');
  });
});
