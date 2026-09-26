import { homeDir } from "@tauri-apps/api/path";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { parse as parseJsonc } from "jsonc-parser";
import { bundledThemesInfo, type ThemeRegistrationAny } from "shiki";
import { APP_NAME } from "./app";
import { basename, dirname } from "./paths";

export type ThemeKind = "light" | "dark";

/** A code theme offered in Settings. `path` is set for themes read from disk. */
export type CodeTheme = {
  id: string;
  label: string;
  kind: ThemeKind;
  source: "Built-in" | "VS Code" | "Custom";
  path?: string;
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

/** Themes bundled with Shiki; they need no files. */
export const BUILT_IN_THEMES: CodeTheme[] = bundledThemesInfo.map((t) => ({
  id: t.id,
  label: t.displayName,
  kind: t.type,
  source: "Built-in",
}));
const BUILT_IN_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));

const EDITORS = ["Visual Studio Code", "VSCodium", "Cursor", "Windsurf"];

/** Where VS Code-family editors keep extensions: per user, and inside each app. */
export function extensionRoots(home: string) {
  return [
    `${home}/.vscode/extensions`,
    `${home}/.vscode-oss/extensions`,
    `${home}/.cursor/extensions`,
    `${home}/.windsurf/extensions`,
    ...EDITORS.map(
      (app) => `/Applications/${app}.app/Contents/Resources/app/extensions`,
    ),
  ];
}

/** Folder for theme files the user adds by hand, relative to home. */
export const CUSTOM_THEMES_DIR = `.${APP_NAME}/themes`;

/** VS Code's JSON flavour: comments and trailing commas allowed. */
async function readJsonc<T>(path: string): Promise<T> {
  const value = parseJsonc(await readTextFile(path), [], {
    allowTrailingComma: true,
  });
  if (value == null || typeof value !== "object") {
    throw new Error(`not a JSON object: ${path}`);
  }
  return value as T;
}

const join = (dir: string, rel: string) => `${dir}/${rel.replace(/^\.\//, "")}`;

type ExtensionManifest = {
  name?: string;
  publisher?: string;
  contributes?: {
    themes?: { id?: string; label: string; uiTheme: string; path: string }[];
  };
};

/** Themes contributed by one extension, with localized labels resolved. */
async function themesInExtension(dir: string): Promise<CodeTheme[]> {
  const manifest = await readJsonc<ExtensionManifest>(`${dir}/package.json`);
  const contributed = manifest.contributes?.themes ?? [];
  if (!contributed.length) return [];

  // Built-in extensions label themes "%key%", translated in package.nls.json.
  const nls = await readJsonc<Record<string, unknown>>(
    `${dir}/package.nls.json`,
  ).catch(() => ({}) as Record<string, unknown>);
  const translate = (label: string) =>
    label.replace(/^%(.+)%$/, (key, name: string) => {
      const value = nls[name];
      if (typeof value === "string") return value;
      const message = (value as { message?: unknown } | undefined)?.message;
      return typeof message === "string" ? message : key;
    });

  // Ids leave out the version so a saved choice survives extension updates.
  const extension = `${manifest.publisher ?? "vscode"}.${manifest.name ?? basename(dir)}`;
  return contributed.map((t) => ({
    id: `vscode:${extension}/${t.id ?? t.label}`,
    label: translate(t.label),
    kind: t.uiTheme === "vs" || t.uiTheme === "hc-light" ? "light" : "dark",
    source: "VS Code",
    path: join(dir, t.path),
  }));
}

async function discoverVsCode(home: string) {
  const perRoot = await Promise.all(
    extensionRoots(home).map(async (root) => {
      const entries = await readDir(root).catch(() => []);
      const perExtension = await Promise.all(
        entries
          .filter((e) => e.isDirectory)
          .map((e) => themesInExtension(`${root}/${e.name}`).catch(() => [])),
      );
      return perExtension.flat();
    }),
  );
  return perRoot.flat();
}

async function discoverCustom(home: string): Promise<CodeTheme[]> {
  const dir = `${home}/${CUSTOM_THEMES_DIR}`;
  const entries = await readDir(dir).catch(() => []);
  const themes = await Promise.all(
    entries
      .filter((e) => !e.isDirectory && e.name.endsWith(".json"))
      .map(async (e): Promise<CodeTheme | null> => {
        const path = `${dir}/${e.name}`;
        try {
          const theme = await readJsonc<{ name?: string; type?: string }>(path);
          return {
            id: `custom:${e.name}`,
            label: theme.name ?? e.name.replace(/\.json$/, ""),
            kind: theme.type === "light" ? "light" : "dark",
            source: "Custom",
            path,
          };
        } catch {
          return null;
        }
      }),
  );
  return themes.filter((t) => t !== null);
}

let discovered: Promise<CodeTheme[]> | null = null;

/**
 * Every theme on offer: built-in, installed in a VS Code-family editor, and
 * custom files. The same extension installed in two editors is listed once.
 * Cached for the session; pass `refresh` to rescan the disk.
 */
export function listThemes(refresh = false) {
  if (!discovered || refresh) {
    discovered = homeDir().then(async (home) => {
      const [vscode, custom] = await Promise.all([
        discoverVsCode(home),
        discoverCustom(home),
      ]);
      const byId = new Map<string, CodeTheme>();
      for (const t of [...BUILT_IN_THEMES, ...vscode, ...custom]) {
        if (!byId.has(t.id)) byId.set(t.id, t);
      }
      return [...byId.values()];
    });
  }
  return discovered;
}

/**
 * Whether a theme is light or dark. Null for "system" and for themes that
 * can't be found, which both mean "follow macOS".
 */
export async function themeKind(id: string): Promise<ThemeKind | null> {
  if (id === SYSTEM_THEME) return null;
  const builtIn = BUILT_IN_THEMES.find((t) => t.id === id);
  if (builtIn) return builtIn.kind;
  const themes = await listThemes().catch(() => []);
  return themes.find((t) => t.id === id)?.kind ?? null;
}

const SOURCES: CodeTheme["source"][] = ["Built-in", "VS Code", "Custom"];

/**
 * Themes grouped by source and sorted by label, for a picker. A `selected`
 * id that no longer exists (say, an uninstalled extension) is kept as a
 * "Missing" entry so the picker still shows what is saved.
 */
export function themeGroups(themes: CodeTheme[], selected: string) {
  const groups = SOURCES.map((source) => ({
    source: source as string,
    themes: themes
      .filter((t) => t.source === source)
      .sort((a, b) => a.label.localeCompare(b.label)),
  })).filter((g) => g.themes.length > 0);

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

type ThemeFile = {
  include?: string;
  colors?: Record<string, string>;
  // A string here points at a .tmTheme file, which isn't supported.
  tokenColors?: unknown[] | string;
  [key: string]: unknown;
};

/** Reads a theme file, merging in any themes it builds on via `include`. */
async function readThemeFile(path: string, depth = 0): Promise<ThemeFile> {
  const theme = await readJsonc<ThemeFile>(path);
  const own = Array.isArray(theme.tokenColors) ? theme.tokenColors : [];
  if (typeof theme.include !== "string" || depth >= 5) {
    return { ...theme, tokenColors: own };
  }
  const base = await readThemeFile(
    join(dirname(path), theme.include),
    depth + 1,
  );
  return {
    ...base,
    ...theme,
    colors: { ...base.colors, ...theme.colors },
    tokenColors: [...(base.tokenColors as unknown[]), ...own],
  };
}

const resolved = new Map<string, Promise<ThemeRegistrationAny | string>>();

/**
 * Turns a saved theme id into something Shiki accepts: a built-in name or a
 * loaded theme. Unknown or unreadable themes fall back to the default for
 * `kind`, so a missing extension never breaks the file viewer.
 */
export function resolveTheme(id: string, kind: ThemeKind) {
  if (BUILT_IN_IDS.has(id)) return Promise.resolve(id);
  const key = `${kind}:${id}`;
  let theme = resolved.get(key);
  if (!theme) {
    theme = listThemes()
      .then(async (themes) => {
        const found = themes.find((t) => t.id === id);
        if (!found?.path) throw new Error(`unknown theme: ${id}`);
        const file = await readThemeFile(found.path);
        return { type: kind, ...file, name: id } as ThemeRegistrationAny;
      })
      .catch(() => DEFAULT_CODE_THEMES[kind]);
    resolved.set(key, theme);
  }
  return theme;
}
