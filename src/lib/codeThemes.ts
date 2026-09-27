import { bundledThemesInfo } from "shiki";

export type ThemeKind = "light" | "dark";

/** A code theme offered in Settings. `path` is set for themes read from disk. */
export type CodeTheme = {
  id: string;
  label: string;
  kind: ThemeKind;
  source: "Built-in" | "VS Code" | "Custom";
  path?: string;
  /** For a custom theme copied from an editor: the editor theme's id. */
  importedFrom?: string;
};

/** Theme ids to highlight with in light and dark appearance. */
export type CodeThemes = Record<ThemeKind, string>;

/** Settings value meaning "follow macOS", using DEFAULT_CODE_THEMES. */
export const SYSTEM_THEME = "system";

export const DEFAULT_CODE_THEMES: CodeThemes = {
  light: "github-light",
  dark: "github-dark",
};

/**
 * The themes to highlight with for a Settings theme value. "system" pairs the
 * defaults so the code switches with macOS; any other theme is used as-is,
 * since it also sets the appearance.
 */
export function codeThemesFor(theme: string): CodeThemes {
  return theme === SYSTEM_THEME
    ? DEFAULT_CODE_THEMES
    : { light: theme, dark: theme };
}

/** Every theme bundled with Shiki; any of them works without files. */
export const BUNDLED = new Map<string, CodeTheme>(
  bundledThemesInfo.map((t) => [
    t.id,
    { id: t.id, label: t.displayName, kind: t.type, source: "Built-in" },
  ]),
);

/** The short list of bundled themes offered in the picker, light then dark. */
const OFFERED = [
  "github-light",
  "light-plus",
  "solarized-light",
  "catppuccin-latte",
  "github-dark",
  "dark-plus",
  "one-dark-pro",
  "dracula",
];

/**
 * Built-in themes shown in Settings. Other bundled ids still resolve if saved.
 * A test checks all of OFFERED exists, in case Shiki renames a theme.
 */
export const BUILT_IN_THEMES: CodeTheme[] = OFFERED.map((id) =>
  BUNDLED.get(id),
).filter((t) => t !== undefined);

const SOURCES: CodeTheme["source"][] = ["Built-in", "VS Code", "Custom"];

/**
 * Themes grouped by source for a picker: built-ins in their curated order,
 * the rest sorted by label. A saved bundled theme outside the short list is
 * shown with the built-ins; a saved id that no longer exists (say, an
 * uninstalled extension) is kept as a "Missing" entry so the picker still
 * shows what is saved.
 */
export function themeGroups(themes: CodeTheme[], selected: string) {
  const extra = BUNDLED.get(selected);
  if (extra && !themes.some((t) => t.id === selected)) {
    themes = [...themes, extra];
  }

  const groups = SOURCES.map((source) => {
    const inSource = themes.filter((t) => t.source === source);
    return {
      source: source as string,
      themes:
        source === "Built-in"
          ? inSource
          : inSource.sort((a, b) => a.label.localeCompare(b.label)),
    };
  }).filter((g) => g.themes.length > 0);

  const known =
    selected === SYSTEM_THEME || themes.some((t) => t.id === selected);
  if (!known) {
    groups.unshift({
      source: "Missing",
      themes: [
        { id: selected, label: selected, kind: "dark", source: "Custom" },
      ],
    });
  }
  return groups;
}
