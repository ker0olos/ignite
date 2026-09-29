import { emit, listen } from "@tauri-apps/api/event";
import {
  BaseDirectory,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { parse, stringify } from "smol-toml";
import type { ApprovalMode } from "../../shared/hostProtocol";
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
  /**
   * `ask_questions`: the agent brings open decisions to the user; off, it decides alone.
   * `text_size`: messages' font size in px, changed with ⌘/Ctrl +, - and 0.
   */
  conversation: {
    show_thinking: boolean;
    ask_questions: boolean;
    text_size: number;
  };
  /** `cmem`: record sessions in cmem and recall its memories. */
  memory: { cmem: boolean };
  /** `mode`: "auto" asks only before risky tool calls, "manual" before all. */
  approval: { mode: ApprovalMode };
  /** `max`: how many subagents one conversation may start. */
  subagents: { enabled: boolean; max: number };
  /** `keep_awake`: the Mac doesn't idle-sleep while an agent works (macOS only). */
  power: { keep_awake: boolean };
};

export const DEFAULT_SETTINGS: Settings = {
  theme: SYSTEM_THEME,
  editor: {
    font_family: "Menlo, Monaco, 'Courier New', monospace",
    word_wrap: false,
  },
  files: { hide_gitignored: true },
  conversation: { show_thinking: false, ask_questions: true, text_size: 14 },
  memory: { cmem: true },
  approval: { mode: "auto" },
  subagents: { enabled: true, max: 2 },
  power: { keep_awake: true },
};

export const MIN_TEXT_SIZE = 10;
export const MAX_TEXT_SIZE = 24;

const clampTextSize = (size: number) =>
  Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(size)));

/** The message text size after ⌘/Ctrl plus `key`, or null when the key isn't a text size shortcut. */
export function nextTextSize(size: number, key: string): number | null {
  if (key === "0") return DEFAULT_SETTINGS.conversation.text_size;
  if (key === "=" || key === "+") return clampTextSize(size + 1);
  if (key === "-") return clampTextSize(size - 1);
  return null;
}

const readConversation = (
  conversation: Partial<Settings["conversation"]> = {},
): Settings["conversation"] => {
  const merged = { ...DEFAULT_SETTINGS.conversation, ...conversation };
  return {
    ...merged,
    text_size: Number.isFinite(merged.text_size)
      ? clampTextSize(merged.text_size)
      : DEFAULT_SETTINGS.conversation.text_size,
  };
};

const readApproval = (
  approval: Partial<Settings["approval"]> = {},
): Settings["approval"] => ({
  mode: approval.mode === "manual" ? "manual" : "auto",
});

const readSubagents = (
  subagents: Partial<Settings["subagents"]> = {},
): Settings["subagents"] => ({
  enabled:
    typeof subagents.enabled === "boolean"
      ? subagents.enabled
      : DEFAULT_SETTINGS.subagents.enabled,
  max:
    typeof subagents.max === "number" &&
    Number.isInteger(subagents.max) &&
    subagents.max >= 1
      ? subagents.max
      : DEFAULT_SETTINGS.subagents.max,
});

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
    conversation: readConversation(raw.conversation),
    memory: { ...DEFAULT_SETTINGS.memory, ...raw.memory },
    approval: readApproval(raw.approval),
    subagents: readSubagents(raw.subagents),
    power: { ...DEFAULT_SETTINGS.power, ...raw.power },
  };
}

/** Writes settings to disk and tells every window about the change. */
export async function saveSettings(settings: Settings) {
  await mkdir(SETTINGS_DIR, { ...HOME, recursive: true });
  await writeTextFile(SETTINGS_FILE, stringify(settings) + "\n", HOME);
  await emit(CHANGED, settings);
}

/** The approval mode setting, and a change that saves it. */
export function approvalSetting(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    mode: settings.approval.mode,
    onChange: (mode: ApprovalMode) =>
      void save({ ...settings, approval: { mode } }),
  };
}

// ponytail: hand edits to settings.toml apply on next window load; fs watch if that matters
export function onSettingsChange(cb: (settings: Settings) => void) {
  return listen<Settings>(CHANGED, ({ payload }) => cb(payload));
}
