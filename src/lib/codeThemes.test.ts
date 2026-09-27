import { describe, expect, it } from "vitest";
import {
  BUILT_IN_THEMES,
  codeThemesFor,
  DEFAULT_CODE_THEMES,
  themeGroups,
  type CodeTheme,
} from "./codeThemes";

describe("codeThemesFor", () => {
  it("pairs GitHub Light and Dark for system", () => {
    expect(codeThemesFor("system")).toEqual({
      light: "github-light",
      dark: "github-dark",
    });
  });

  it("uses a chosen theme for both appearances", () => {
    expect(codeThemesFor("dracula")).toEqual({
      light: "dracula",
      dark: "dracula",
    });
  });
});

describe("BUILT_IN_THEMES", () => {
  it("offers a short list, split evenly between light and dark", () => {
    const kinds = BUILT_IN_THEMES.map((t) => t.kind);
    expect(kinds).toHaveLength(8);
    expect(kinds.filter((k) => k === "light")).toHaveLength(4);
  });

  it("includes the System pair", () => {
    const ids = BUILT_IN_THEMES.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        DEFAULT_CODE_THEMES.light,
        DEFAULT_CODE_THEMES.dark,
      ]),
    );
  });
});

describe("themeGroups", () => {
  const theme = (
    id: string,
    source: CodeTheme["source"],
    label = id,
  ): CodeTheme => ({ id, label, kind: "dark", source });

  const themes = [
    theme("z", "Built-in", "Zed"),
    theme("a", "Built-in", "Alpha"),
    theme("custom:mine.json", "Custom", "Mine"),
    theme("vscode:p.x/T", "VS Code", "Theirs"),
  ];

  it("groups by source, built-ins in their given order, the rest by label", () => {
    const more = [...themes, theme("vscode:p.x/A", "VS Code", "Another")];
    expect(
      themeGroups(more, "a").map((g) => [
        g.source,
        g.themes.map((t) => t.label),
      ]),
    ).toEqual([
      ["Built-in", ["Zed", "Alpha"]],
      ["VS Code", ["Another", "Theirs"]],
      ["Custom", ["Mine"]],
    ]);
  });

  it("shows a saved bundled theme outside the short list with the built-ins", () => {
    const groups = themeGroups(themes, "nord");
    expect(groups[0]).toMatchObject({ source: "Built-in" });
    expect(groups[0].themes.at(-1)).toMatchObject({
      id: "nord",
      label: "Nord",
    });
    expect(groups.map((g) => g.source)).not.toContain("Missing");
  });

  it("leaves out empty groups", () => {
    const groups = themeGroups([theme("a", "Built-in")], "a");
    expect(groups.map((g) => g.source)).toEqual(["Built-in"]);
  });

  it("keeps a saved theme that no longer exists, first, as Missing", () => {
    const groups = themeGroups(themes, "vscode:gone/Old");
    expect(groups[0]).toMatchObject({
      source: "Missing",
      themes: [{ id: "vscode:gone/Old" }],
    });
  });

  it("does not treat system as missing", () => {
    const groups = themeGroups(themes, "system");
    expect(groups.map((g) => g.source)).not.toContain("Missing");
  });
});
