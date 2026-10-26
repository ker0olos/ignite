import type { ApprovalMode } from "../../shared/hostProtocol";
import { SYSTEM_THEME } from "./codeThemes";
import { MINIMAL_ICONS } from "./iconResolve";

/** Shape of ~/.<APP_NAME>/settings.toml (keys stay snake_case, as in TOML). */
export type Settings = {
  /**
   * "system", or a theme id from codeThemes.ts. The theme colours code and
   * decides light or dark mode; "system" follows macOS.
   */
  theme: string;
  /** "minimal" (the app's own glyphs), or a VS Code icon theme's id from iconThemes.ts. */
  icon_theme: string;
  /** How the file viewer shows code. `font_family` is a CSS font-family list. */
  editor: { font_family: string; word_wrap: boolean };
  /** `show_tree`: the sidebar lists the folder's files under its conversations. */
  files: { hide_gitignored: boolean; show_tree: boolean };
  /**
   * `ask_questions`: the agent brings open decisions to the user; off, it decides alone.
   * `model_router`: new conversations start on Router, the model menu's last pick (on by default); picking a model turns it off.
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
  /** `enabled`: record what conversations do, and recall it in later ones. */
  memory: { enabled: boolean };
  /** Each `enabled`: that learning records new ones and the agent uses them (procedures also need memory on). */
  lessons: { enabled: boolean };
  reflector: { enabled: boolean };
  procedures: { enabled: boolean };
  /**
   * `mode`: "auto" asks only before risky tool calls, "manual" before all.
   * `full_access`: Auto runs every tool call without asking or the sandbox.
   * `windows_sandbox`: Auto sandboxes bash on Windows instead of asking (alpha).
   */
  approval: {
    mode: ApprovalMode;
    full_access: boolean;
    windows_sandbox: boolean;
  };
  /** `max`: how many of a conversation's subagents run at once; the rest queue. */
  subagents: { enabled: boolean; max: number };
  /**
   * `keep_awake`: the Mac doesn't idle-sleep while an agent works (macOS only).
   * `keep_screen_awake`: nor does the display.
   */
  power: { keep_awake: boolean; keep_screen_awake: boolean };
  /** `liquid_glass`: the sidebar shows Liquid Glass (macOS only). */
  mac: { liquid_glass: boolean };
  notifications: { enabled: boolean; sound: boolean };
  /** `disabled_tools`: Chrome tools (shared/chrome.ts) the agent doesn't get. */
  chrome: { enabled: boolean; disabled_tools: string[] };
  /** Remote access from browsers on other devices. */
  remote: { enabled: boolean; port: number };
};

export type ConversationOrder = "oldest_first" | "newest_first";

export const DEFAULT_SETTINGS: Settings = {
  theme: SYSTEM_THEME,
  icon_theme: MINIMAL_ICONS,
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
  memory: { enabled: true },
  lessons: { enabled: true },
  reflector: { enabled: true },
  procedures: { enabled: true },
  approval: { mode: "auto", full_access: false, windows_sandbox: false },
  subagents: { enabled: true, max: 2 },
  power: { keep_awake: true, keep_screen_awake: false },
  mac: { liquid_glass: true },
  notifications: { enabled: true, sound: true },
  chrome: { enabled: true, disabled_tools: [] },
  remote: { enabled: false, port: 4280 },
};

export const MIN_TEXT_SIZE = 10;
export const MAX_TEXT_SIZE = 24;
export const MIN_SIDEBAR_CONVERSATIONS = 1;
export const MAX_SIDEBAR_CONVERSATIONS = 20;
