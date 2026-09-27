import { BaseDirectory, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ThemeRegistrationAny } from "shiki";
import {
  CUSTOM_THEMES_DIR,
  IMPORTED_FROM,
  importedFileName,
  invalidateThemes,
  join,
  listThemes,
  readJsonc,
} from "./codeThemeDiscovery";
import { BUNDLED, DEFAULT_CODE_THEMES, SYSTEM_THEME } from "./codeThemes";
import type { ThemeKind } from "./codeThemes";
import { dirname } from "./paths";

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
  if (BUNDLED.has(id)) return Promise.resolve(id);
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

/**
 * Whether a theme is light or dark. Null for "system" and for themes that
 * can't be found, which both mean "follow macOS".
 */
export async function themeKind(id: string): Promise<ThemeKind | null> {
  if (id === SYSTEM_THEME) return null;
  const builtIn = BUNDLED.get(id);
  if (builtIn) return builtIn.kind;
  const themes = await listThemes().catch(() => []);
  return themes.find((t) => t.id === id)?.kind ?? null;
}

/**
 * Copies an editor theme into the custom themes folder (includes merged in,
 * so it stands alone) and returns the copy's id. Anything that isn't an
 * editor theme, or can't be found or read, is returned unchanged.
 */
export async function importTheme(id: string): Promise<string> {
  if (!id.startsWith("vscode:")) return id;
  try {
    const theme = (await listThemes()).find((t) => t.id === id);
    if (!theme?.path) return id;
    const file = await readThemeFile(theme.path);
    // Already merged in; the copy must not point at the editor's files.
    delete file.include;
    const name = importedFileName(id);
    const home = { baseDir: BaseDirectory.Home };
    await mkdir(CUSTOM_THEMES_DIR, { ...home, recursive: true });
    await writeTextFile(
      `${CUSTOM_THEMES_DIR}/${name}`,
      JSON.stringify(
        {
          ...file,
          name: theme.label,
          type: theme.kind,
          [IMPORTED_FROM]: id,
        },
        null,
        2,
      ) + "\n",
      home,
    );
    invalidateThemes();
    return `custom:${name}`;
  } catch {
    return id;
  }
}
