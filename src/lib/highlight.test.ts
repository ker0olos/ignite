import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

/** Distinct light-theme token colours in Shiki's output. */
function colours(html: string) {
  return new Set(html.match(/--shiki-light:#[0-9a-fA-F]+/g));
}

describe("highlight", () => {
  it("colours tokens for a known language", async () => {
    const html = await highlight("const answer: number = 42;", "/src/a.ts");
    expect(colours(html).size).toBeGreaterThan(1);
  });

  it("emits both theme variables so CSS can switch light and dark", async () => {
    const html = await highlight("let x = 1", "/a.js");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("falls back to plain text for an unknown extension", async () => {
    const html = await highlight("const x = 1;", "/notes.unknownext");
    expect(colours(html).size).toBeLessThanOrEqual(1);
  });

  it("recognises extensionless names Shiki knows, like Dockerfile", async () => {
    const html = await highlight("FROM node:22\nRUN npm ci", "/Dockerfile");
    expect(colours(html).size).toBeGreaterThan(1);
  });

  it("skips highlighting for very large files", async () => {
    const big = "const x = 1;\n".repeat(30_000);
    const html = await highlight(big, "/big.ts");
    expect(colours(html).size).toBeLessThanOrEqual(1);
  });

  it("escapes file contents", async () => {
    const html = await highlight("<script>alert(1)</script>", "/x.txt");
    expect(html).not.toContain("<script>");
  });
});
