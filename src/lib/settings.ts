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
  /** `show_tree`: the sidebar lists the folder's files under its conversations. */
  files: { hide_gitignored: boolean; show_tree: boolean };
  /**
   * `ask_questions`: the agent brings open decisions to the user; off, it decides alone.
   * `model_router`: before a conversation's first message a quick model picks the model and effort it runs on (on by default).
   * `text_size`: messages' font size in px, changed with ⌘/Ctrl +, - and 0.
   * `sticky_user_messages`: user messages pin to the top while their replies scroll.
   */
  conversation: {
    show_thinking: boolean;
    ask_questions: boolean;
    model_router: boolean;
    text_size: number;
    sticky_user_messages: boolean;
  };
  /**
   * `conversation_order`: conversation order within a folder.
   * `max_conversations_*`: collapse each folder after the configured count.
   * `resizable_split`: drag-resize conversations vs files.
   */
  sidebar: {
    conversation_order: ConversationOrder;
    max_conversations_enabled: boolean;
    max_conversations: number;
    resizable_split: boolean;
  };
  /** `git_status`: the composer lists the conversation's repositories with unfinished git work. */
  composer: { git_status: boolean };
  /** `cmem`: record sessions in cmem and recall its memories. */
  memory: { cmem: boolean };
  /**
   * `mode`: "auto" asks only before risky tool calls, "manual" before all.
   * `full_access`: Auto runs every tool call without asking or the sandbox.
   */
  approval: { mode: ApprovalMode; full_access: boolean };
  /** `max`: how many of a conversation's subagents run at once; the rest queue. */
  subagents: { enabled: boolean; max: number };
  /**
   * `keep_awake`: the Mac doesn't idle-sleep while an agent works (macOS only).
   * `keep_screen_awake`: nor does the display.
   */
  power: { keep_awake: boolean; keep_screen_awake: boolean };
  notifications: { enabled: boolean; sound: boolean };
  /** `disabled_tools`: Chrome tools (shared/chrome.ts) the agent doesn't get. */
  chrome: { enabled: boolean; disabled_tools: string[] };
  /** Remote access from browsers on other devices. */
  remote: { enabled: boolean; port: number };
};

export type ConversationOrder = "oldest_first" | "newest_first";

export const DEFAULT_SETTINGS: Settings = {
  theme: SYSTEM_THEME,
  editor: {
    font_family: "Menlo, Monaco, 'Courier New', monospace",
    word_wrap: true,
  },
  files: { hide_gitignored: true, show_tree: true },
  conversation: {
    show_thinking: false,
    ask_questions: true,
    model_router: true,
    text_size: 14,
    sticky_user_messages: false,
  },
  sidebar: {
    conversation_order: "oldest_first",
    max_conversations_enabled: false,
    max_conversations: 5,
    resizable_split: true,
  },
  composer: { git_status: true },
  memory: { cmem: true },
  approval: { mode: "auto", full_access: false },
  subagents: { enabled: true, max: 2 },
  power: { keep_awake: true, keep_screen_awake: false },
  notifications: { enabled: true, sound: true },
  chrome: { enabled: true, disabled_tools: [] },
  remote: { enabled: false, port: 4280 },
};

export const MIN_TEXT_SIZE = 10;
export const MAX_TEXT_SIZE = 24;
export const MIN_SIDEBAR_CONVERSATIONS = 1;
export const MAX_SIDEBAR_CONVERSATIONS = 20;

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
    files: readFiles(raw.files),
    conversation: readConversation(raw.conversation),
    sidebar: readSidebar(raw.sidebar),
    composer: { git_status: raw.composer?.git_status !== false },
    memory: { ...DEFAULT_SETTINGS.memory, ...raw.memory },
    approval: readApproval(raw.approval),
    subagents: readSubagents(raw.subagents),
    power: { ...DEFAULT_SETTINGS.power, ...raw.power },
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

/** The approval mode setting, and a change that saves it. */
export function approvalSetting(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    mode: settings.approval.mode,
    onChange: (mode: ApprovalMode) =>
      void save({ ...settings, approval: { ...settings.approval, mode } }),
  };
}

/** The Model Router setting, and a change that saves it. */
export function modelRouterSetting(
  settings: Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    on: settings.conversation.model_router,
    onChange: (model_router: boolean) =>
      void save({
        ...settings,
        conversation: { ...settings.conversation, model_router },
      }),
  };
}

// ponytail: hand edits to settings.toml apply on next window load; fs watch if that matters
export function onSettingsChange(cb: (settings: Settings) => void) {
  return listen<Settings>(CHANGED, ({ payload }) => cb(payload));
}
