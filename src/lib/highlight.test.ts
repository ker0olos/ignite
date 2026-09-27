import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { highlight, highlightLines } from "./highlight";

const THEMES = { light: "github-light", dark: "github-dark" };

/** Distinct light-theme token colours in Shiki's output. */
function colours(html: string) {
  return new Set(html.match(/--shiki-light:#[0-9a-fA-F]+/g));
}

// Built-in themes need no IPC; any call means a file theme leaked in.
beforeEach(() =>
  mockIPC((cmd) => {
    throw new Error(`unexpected IPC: ${cmd}`);
  }),
);

describe("highlight", () => {
  it("colours tokens for a known language", async () => {
    const html = await highlight("const answer: number = 42;", "/a.ts", THEMES);
    expect(colours(html).size).toBeGreaterThan(1);
  });

  it("emits both theme variables so CSS can switch light and dark", async () => {
    const html = await highlight("let x = 1", "/a.js", THEMES);
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("uses the chosen themes", async () => {
    const code = "const x = 1;";
    const github = await highlight(code, "/a.ts", THEMES);
    const other = await highlight(code, "/a.ts", {
      light: "solarized-light",
      dark: "dracula",
    });
    expect(other).not.toEqual(github);
    expect(other).toContain("--shiki-dark:#FF79C6"); // Dracula's keyword pink
  });

  it("falls back to plain text for an unknown extension", async () => {
    const html = await highlight("const x = 1;", "/notes.unknownext", THEMES);
    expect(colours(html).size).toBeLessThanOrEqual(1);
  });

  it("recognises extensionless names Shiki knows, like Dockerfile", async () => {
    const html = await highlight(
      "FROM node:22\nRUN npm ci",
      "/Dockerfile",
      THEMES,
    );
    expect(colours(html).size).toBeGreaterThan(1);
  });

  it("skips highlighting for very large files", async () => {
    const big = "const x = 1;\n".repeat(30_000);
    const html = await highlight(big, "/big.ts", THEMES);
    expect(colours(html).size).toBeLessThanOrEqual(1);
  });

  it("escapes file contents", async () => {
    const html = await highlight("<script>alert(1)</script>", "/x.txt", THEMES);
    expect(html).not.toContain("<script>");
  });
});

describe("highlightLines", () => {
  it("returns tokens per line carrying both theme variables", async () => {
    const lines = await highlightLines("const a = 1;\nlet b;", "/a.ts", THEMES);
    expect(lines).toHaveLength(2);
    expect(lines[0].map((t) => t.content).join("")).toBe("const a = 1;");
    expect(lines[0][0].style["--shiki-light"]).toBeTruthy();
    expect(lines[0][0].style["--shiki-dark"]).toBeTruthy();
  });
});
