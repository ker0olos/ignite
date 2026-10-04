import { afterEach, describe, expect, it, vi } from "vitest";

const load = vi.hoisted(() => ({ fail: false }));
vi.mock("./codeThemeLoad", () => ({
  resolveTheme: async (id: string) => {
    if (load.fail) throw new Error("unreadable");
    return id.startsWith("custom:")
      ? {
          tokenColors: [{ scope: "keyword", settings: { foreground: "#f0f" } }],
        }
      : id;
  },
}));

const { applyPalettes, loadPalettes, paletteOf } =
  await import("./themePalette");

afterEach(() => {
  load.fail = false;
  document.documentElement.removeAttribute("style");
});

describe("paletteOf", () => {
  it("tints code like strings, and takes the terminal's colors", () => {
    expect(
      paletteOf({
        colors: {
          "terminal.ansiGreen": "#0f0",
          "editorWarning.foreground": "#ff0",
          "terminal.ansiRed": "#f00",
        },
        tokenColors: [
          { scope: ["comment"], settings: { foreground: "#888" } },
          {
            scope: ["string", "string.quoted"],
            settings: { foreground: "#9cf" },
          },
        ],
      }),
    ).toEqual({
      code: "#9cf",
      success: "#0f0",
      warning: "#ff0",
      destructive: "#f00",
    });
  });

  it("falls back to keywords for code, and leaves out what isn't set", () => {
    expect(
      paletteOf({
        settings: [{ scope: "keyword", settings: { foreground: "#f0f" } }],
      }),
    ).toEqual({ code: "#f0f" });
    expect(paletteOf({})).toEqual({});
  });
});

describe("loadPalettes", () => {
  it("reads built-in and custom themes", async () => {
    const palettes = await loadPalettes({
      light: "github-light",
      dark: "custom:mine.json",
    });
    expect(palettes.light.code).toBe("#032f62");
    expect(palettes.dark).toEqual({ code: "#f0f" });
  });

  it("is empty for a theme it can't read", async () => {
    load.fail = true;
    expect(
      await loadPalettes({ light: "github-light", dark: "github-dark" }),
    ).toEqual({ light: {}, dark: {} });
  });
});

describe("applyPalettes", () => {
  it("sets each kind's colors and removes ones the next theme lacks", () => {
    const root = document.documentElement;
    applyPalettes({ light: { code: "#123" }, dark: { success: "#0f0" } });
    expect(root.style.getPropertyValue("--theme-code-light")).toBe("#123");
    expect(root.style.getPropertyValue("--theme-success-dark")).toBe("#0f0");
    applyPalettes({ light: {}, dark: {} });
    expect(root.style.getPropertyValue("--theme-code-light")).toBe("");
  });
});
