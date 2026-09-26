import { emit, listen } from "@tauri-apps/api/event";
import {
  BaseDirectory,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { parse, stringify } from "smol-toml";
import { APP_NAME } from "./app";
import { SYSTEM_THEME } from "./codeThemes";

/** Shape of ~/.<APP_NAME>/settings.toml (keys stay snake_case, as in TOML). */
export type Settings = {
  /**
   * "system", or a theme id from codeThemes.ts. The theme colours code and
   * decides light or dark mode; "system" follows macOS.
   */
  theme: string;
  /** How the file viewer shows code. `font_family` is a CSS font-family list. */
  editor: { font_family: string; word_wrap: boolean };
  files: { hide_gitignored: boolean };
};

export const DEFAULT_SETTINGS: Settings = {
  theme: SYSTEM_THEME,
  editor: {
    font_family: "Menlo, Monaco, 'Courier New', monospace",
    word_wrap: false,
  },
  files: { hide_gitignored: true },
};

// Earlier versions stored the appearance itself; map it to the matching theme.
const LEGACY_THEMES: Record<string, string> = {
  light: "github-light",
  dark: "github-dark",
};

/** Relative to the home directory. */
export const SETTINGS_DIR = `.${APP_NAME}`;
export const SETTINGS_FILE = `${SETTINGS_DIR}/settings.toml`;
const HOME = { baseDir: BaseDirectory.Home };
const CHANGED = "settings://changed";

/** Reads settings, falling back to defaults for a missing file or bad values. */
export async function loadSettings(): Promise<Settings> {
  let raw: Partial<Settings>;
  try {
    raw = parse(await readTextFile(SETTINGS_FILE, HOME)) as Partial<Settings>;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const theme =
    typeof raw.theme === "string" && raw.theme
      ? (LEGACY_THEMES[raw.theme] ?? raw.theme)
      : DEFAULT_SETTINGS.theme;
  const editor: Partial<Settings["editor"]> = raw.editor ?? {};
  return {
    theme,
    editor: {
      font_family:
        typeof editor.font_family === "string" && editor.font_family.trim()
          ? editor.font_family
          : DEFAULT_SETTINGS.editor.font_family,
      word_wrap:
        typeof editor.word_wrap === "boolean"
          ? editor.word_wrap
          : DEFAULT_SETTINGS.editor.word_wrap,
    },
    files: { ...DEFAULT_SETTINGS.files, ...raw.files },
  };
}

/** Writes settings to disk and tells every window about the change. */
export async function saveSettings(settings: Settings) {
  await mkdir(SETTINGS_DIR, { ...HOME, recursive: true });
  await writeTextFile(SETTINGS_FILE, stringify(settings) + "\n", HOME);
  await emit(CHANGED, settings);
}

// ponytail: hand edits to settings.toml apply on next window load; fs watch if that matters
export function onSettingsChange(cb: (settings: Settings) => void) {
  return listen<Settings>(CHANGED, ({ payload }) => cb(payload));
}
