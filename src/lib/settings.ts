import { emit, listen } from "@tauri-apps/api/event";
import {
  BaseDirectory,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { parse, stringify } from "smol-toml";
import { APP_NAME } from "./app";

import {
  DEFAULT_SETTINGS,
  MAX_SIDEBAR_CONVERSATIONS,
  MAX_TEXT_SIZE,
  MIN_SIDEBAR_CONVERSATIONS,
  MIN_TEXT_SIZE,
  type Settings,
} from "./settingsDefaults";

export {
  DEFAULT_SETTINGS,
  MAX_SIDEBAR_CONVERSATIONS,
  MAX_TEXT_SIZE,
  MIN_SIDEBAR_CONVERSATIONS,
  MIN_TEXT_SIZE,
};
export type { ConversationOrder, Settings } from "./settingsDefaults";

const clampTextSize = (size: number) =>
  Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(size)));

const clampSidebarConversations = (size: number) =>
  Math.min(
    MAX_SIDEBAR_CONVERSATIONS,
    Math.max(MIN_SIDEBAR_CONVERSATIONS, Math.round(size)),
  );

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
    model_router: merged.model_router !== false,
    text_size: Number.isFinite(merged.text_size)
      ? clampTextSize(merged.text_size)
      : DEFAULT_SETTINGS.conversation.text_size,
  };
};

const readSidebar = (
  sidebar: Partial<Settings["sidebar"]> = {},
): Settings["sidebar"] => {
  const merged = { ...DEFAULT_SETTINGS.sidebar, ...sidebar };
  return {
    conversation_order:
      merged.conversation_order === "newest_first"
        ? "newest_first"
        : DEFAULT_SETTINGS.sidebar.conversation_order,
    max_conversations_enabled:
      typeof merged.max_conversations_enabled === "boolean"
        ? merged.max_conversations_enabled
        : DEFAULT_SETTINGS.sidebar.max_conversations_enabled,
    max_conversations: Number.isFinite(merged.max_conversations)
      ? clampSidebarConversations(merged.max_conversations)
      : DEFAULT_SETTINGS.sidebar.max_conversations,
    resizable_split:
      typeof merged.resizable_split === "boolean"
        ? merged.resizable_split
        : DEFAULT_SETTINGS.sidebar.resizable_split,
  };
};

const readFiles = (
  files: Partial<Settings["files"]> = {},
): Settings["files"] => ({
  hide_gitignored:
    typeof files.hide_gitignored === "boolean"
      ? files.hide_gitignored
      : DEFAULT_SETTINGS.files.hide_gitignored,
  show_tree:
    typeof files.show_tree === "boolean"
      ? files.show_tree
      : DEFAULT_SETTINGS.files.show_tree,
});

const readApproval = (
  approval: Partial<Settings["approval"]> = {},
): Settings["approval"] => ({
  mode: approval.mode === "manual" ? "manual" : "auto",
  full_access: approval.full_access === true,
  windows_sandbox: approval.windows_sandbox === true,
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

const readChrome = (
  chrome: Partial<Settings["chrome"]> = {},
): Settings["chrome"] => ({
  enabled: chrome.enabled !== false,
  disabled_tools: Array.isArray(chrome.disabled_tools)
    ? chrome.disabled_tools.filter((t) => typeof t === "string")
    : [],
});

const readRemote = (
  remote: Partial<Settings["remote"]> = {},
): Settings["remote"] => ({
  enabled: remote.enabled === true,
  port:
    Number.isInteger(remote.port) && remote.port! > 0 && remote.port! < 65536
      ? remote.port!
      : DEFAULT_SETTINGS.remote.port,
});

const readIconTheme = (value: unknown) =>
  typeof value === "string" && value ? value : DEFAULT_SETTINGS.icon_theme;

// Earlier versions stored the appearance itself; map it to the matching theme.
const LEGACY_THEMES: Record<string, string> = {
  light: "github-light",
  dark: "github-dark",
};

/** Relative to the home directory. */
export const SETTINGS_DIR = `.${APP_NAME}`;
export const SETTINGS_FILE = `${SETTINGS_DIR}/settings.toml`;
// Memory was cmem's switch, `cmem`, before the app kept its own.
const readMemory = (memory?: { enabled?: unknown; cmem?: unknown }) => ({
  enabled: (memory?.enabled ?? memory?.cmem) !== false,
});

const onUnlessOff = (section?: { enabled?: unknown }) => ({
  enabled: section?.enabled !== false,
});

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
    icon_theme: readIconTheme(raw.icon_theme),
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
    files: readFiles(raw.files),
    conversation: readConversation(raw.conversation),
    sidebar: readSidebar(raw.sidebar),
    composer: { git_status: raw.composer?.git_status !== false },
    memory: readMemory(raw.memory),
    lessons: onUnlessOff(raw.lessons),
    reflector: onUnlessOff(raw.reflector),
    procedures: onUnlessOff(raw.procedures),
    approval: readApproval(raw.approval),
    subagents: readSubagents(raw.subagents),
    power: { ...DEFAULT_SETTINGS.power, ...raw.power },
    mac: { ...DEFAULT_SETTINGS.mac, ...raw.mac },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...raw.notifications,
    },
    chrome: readChrome(raw.chrome),
    remote: readRemote(raw.remote),
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
