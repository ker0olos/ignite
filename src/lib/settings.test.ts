import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import {
  DEFAULT_SETTINGS,
  SETTINGS_DIR,
  SETTINGS_FILE,
  loadSettings,
  nextTextSize,
  onSettingsChange,
  saveSettings,
  type Settings,
} from "./settings";

// readTextFile is called with baseDir: Home, so the path the backend sees is relative.
const FILE = SETTINGS_FILE;

describe("loadSettings", () => {
  it("returns defaults when the file doesn't exist", async () => {
    fakeFs({});
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when the file is not valid TOML", async () => {
    fakeFs({ [FILE]: "theme = = broken" });
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("reads saved values", async () => {
    fakeFs({
      [FILE]: 'theme = "dracula"\n[files]\nhide_gitignored = false\n',
    });
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "dracula",
      files: { hide_gitignored: false, show_tree: true },
    });
  });

  it("reads show_tree and ignores a non-boolean", async () => {
    fakeFs({ [FILE]: "[files]\nshow_tree = false\n" });
    expect((await loadSettings()).files.show_tree).toBe(false);
    fakeFs({ [FILE]: '[files]\nshow_tree = "no"\nhide_gitignored = 1\n' });
    expect((await loadSettings()).files).toEqual(DEFAULT_SETTINGS.files);
  });

  it("reads editor settings", async () => {
    fakeFs({
      [FILE]: '[editor]\nfont_family = "Monaco"\nword_wrap = false\n',
    });
    expect((await loadSettings()).editor).toEqual({
      font_family: "Monaco",
      word_wrap: false,
    });
  });

  it.each([
    ["an empty font", 'font_family = "  "\nword_wrap = false'],
    ["wrong types", "font_family = 3\nword_wrap = false"],
  ])("falls back to the default font for %s", async (_, toml) => {
    fakeFs({ [FILE]: `[editor]\n${toml}\n` });
    expect((await loadSettings()).editor).toEqual({
      font_family: DEFAULT_SETTINGS.editor.font_family,
      word_wrap: false,
    });
  });

  it("falls back to the default word wrap when it isn't a boolean", async () => {
    fakeFs({ [FILE]: '[editor]\nword_wrap = "yes"\n' });
    expect((await loadSettings()).editor).toEqual(DEFAULT_SETTINGS.editor);
  });

  it("reads conversation settings", async () => {
    fakeFs({ [FILE]: "[conversation]\nshow_thinking = true\n" });
    expect((await loadSettings()).conversation).toEqual({
      show_thinking: true,
      ask_questions: true,
      model_router: true,
      text_size: 14,
      sticky_user_messages: false,
    });
    fakeFs({ [FILE]: "[conversation]\nmodel_router = false\n" });
    expect((await loadSettings()).conversation.model_router).toBe(false);
    fakeFs({ [FILE]: '[conversation]\nmodel_router = "yes"\n' });
    expect((await loadSettings()).conversation.model_router).toBe(true);
    fakeFs({ [FILE]: "[conversation]\nask_questions = false\n" });
    expect((await loadSettings()).conversation.ask_questions).toBe(false);
    fakeFs({ [FILE]: "[conversation]\nsticky_user_messages = true\n" });
    expect((await loadSettings()).conversation.sticky_user_messages).toBe(true);
  });

  it.each([
    ["16", 16],
    ["99", 24],
    ["2", 10],
    ['"big"', 14],
  ])("reads text_size = %s as %d", async (value, size) => {
    fakeFs({ [FILE]: `[conversation]\ntext_size = ${value}\n` });
    expect((await loadSettings()).conversation.text_size).toBe(size);
  });

  it("reads whether the sidebar split is resizable", async () => {
    fakeFs({ [FILE]: "[sidebar]\nresizable_split = false\n" });
    expect((await loadSettings()).sidebar.resizable_split).toBe(false);
    fakeFs({ [FILE]: '[sidebar]\nresizable_split = "no"\n' });
    expect((await loadSettings()).sidebar.resizable_split).toBe(true);
  });

  it("reads conversation order settings", async () => {
    fakeFs({ [FILE]: '[sidebar]\nconversation_order = "newest_first"\n' });
    expect((await loadSettings()).sidebar.conversation_order).toBe(
      "newest_first",
    );
    fakeFs({ [FILE]: '[sidebar]\nconversation_order = "sideways"\n' });
    expect((await loadSettings()).sidebar.conversation_order).toBe(
      "oldest_first",
    );
  });

  it.each([
    ["8", 8],
    ["99", 20],
    ["0", 1],
    ['"many"', 5],
  ])("reads max_conversations = %s as %d", async (value, count) => {
    fakeFs({ [FILE]: `[sidebar]\nmax_conversations = ${value}\n` });
    expect((await loadSettings()).sidebar.max_conversations).toBe(count);
  });

  it("reads whether the sidebar conversation limit is enabled", async () => {
    fakeFs({ [FILE]: "[sidebar]\nmax_conversations_enabled = true\n" });
    expect((await loadSettings()).sidebar.max_conversations_enabled).toBe(true);
    fakeFs({ [FILE]: '[sidebar]\nmax_conversations_enabled = "yes"\n' });
    expect((await loadSettings()).sidebar.max_conversations_enabled).toBe(
      false,
    );
  });

  it("defaults the sidebar settings", async () => {
    fakeFs({});
    expect((await loadSettings()).sidebar).toEqual({
      conversation_order: "oldest_first",
      max_conversations_enabled: false,
      max_conversations: 5,
      resizable_split: true,
    });
  });

  it.each([
    ["off", "git_status = false", false],
    ["not a boolean", 'git_status = "no"', true],
    ["missing", "", true],
  ])("reads the composer's git status setting when %s", async (_, toml, on) => {
    fakeFs({ [FILE]: `[composer]\n${toml}\n` });
    expect((await loadSettings()).composer).toEqual({ git_status: on });
  });

  it("reads memory settings", async () => {
    fakeFs({ [FILE]: "[memory]\ncmem = false\n" });
    expect((await loadSettings()).memory).toEqual({ cmem: false });
  });

  it("reads the Manual approval mode, full access and the Windows sandbox", async () => {
    fakeFs({
      [FILE]:
        '[approval]\nmode = "manual"\nfull_access = true\nwindows_sandbox = true\n',
    });
    expect((await loadSettings()).approval).toEqual({
      mode: "manual",
      full_access: true,
      windows_sandbox: true,
    });
  });

  it("falls back to Auto for an approval mode it doesn't know", async () => {
    fakeFs({
      [FILE]:
        '[approval]\nmode = "never"\nfull_access = 1\nwindows_sandbox = "yes"\n',
    });
    expect((await loadSettings()).approval).toEqual({
      mode: "auto",
      full_access: false,
      windows_sandbox: false,
    });
  });

  it("defaults subagents on with a max of 2", async () => {
    fakeFs({});
    expect((await loadSettings()).subagents).toEqual({
      enabled: true,
      max: 2,
    });
  });

  it("reads subagent settings", async () => {
    fakeFs({ [FILE]: "[subagents]\nenabled = false\nmax = 4\n" });
    expect((await loadSettings()).subagents).toEqual({
      enabled: false,
      max: 4,
    });
  });

  it.each([
    ["not a boolean", "enabled = 1"],
    ["missing", ""],
  ])("falls back to enabled for %s", async (_, toml) => {
    fakeFs({ [FILE]: `[subagents]\n${toml}\n` });
    expect((await loadSettings()).subagents.enabled).toBe(true);
  });

  it.each([
    ["zero", "max = 0"],
    ["not a whole number", "max = 2.5"],
    ["not a number", 'max = "3"'],
    ["missing", ""],
  ])("falls back to a max of 2 for %s", async (_, toml) => {
    fakeFs({ [FILE]: `[subagents]\n${toml}\n` });
    expect((await loadSettings()).subagents.max).toBe(2);
  });

  it("reads Chrome settings, keeping only named tools", async () => {
    fakeFs({
      [FILE]: '[chrome]\nenabled = false\ndisabled_tools = ["chrome_cdp", 3]\n',
    });
    expect((await loadSettings()).chrome).toEqual({
      enabled: false,
      disabled_tools: ["chrome_cdp"],
    });
  });

  it("falls back to Chrome on with every tool for bad values", async () => {
    fakeFs({ [FILE]: '[chrome]\nenabled = "no"\ndisabled_tools = "x"\n' });
    expect((await loadSettings()).chrome).toEqual(DEFAULT_SETTINGS.chrome);
  });

  it("fills in missing keys from defaults", async () => {
    fakeFs({ [FILE]: 'theme = "nord"\n' });
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "nord",
    });
  });

  it("keeps theme ids it doesn't know, since they may come from extensions", async () => {
    fakeFs({ [FILE]: 'theme = "vscode:me.theme/Mine"\n' });
    expect((await loadSettings()).theme).toBe("vscode:me.theme/Mine");
  });

  it.each([
    ["light", "github-light"],
    ["dark", "github-dark"],
  ])("maps the old appearance value %s to the %s theme", async (old, theme) => {
    fakeFs({ [FILE]: `theme = "${old}"\n` });
    expect((await loadSettings()).theme).toBe(theme);
  });

  it.each([
    ["a number", "theme = 3"],
    ["an empty string", 'theme = ""'],
  ])("falls back to the default theme for %s", async (_, toml) => {
    fakeFs({ [FILE]: `${toml}\n[files]\nhide_gitignored = false\n` });
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      files: { hide_gitignored: false, show_tree: true },
    });
  });
});

describe("saveSettings", () => {
  const next: Settings = {
    theme: "github-dark",
    editor: { font_family: "Monaco, monospace", word_wrap: true },
    files: { hide_gitignored: false, show_tree: false },
    conversation: {
      show_thinking: true,
      ask_questions: false,
      model_router: true,
      text_size: 15,
      sticky_user_messages: true,
    },
    sidebar: {
      conversation_order: "newest_first",
      max_conversations_enabled: true,
      max_conversations: 8,
      resizable_split: true,
    },
    composer: { git_status: false },
    memory: { cmem: false },
    approval: { mode: "manual", full_access: false, windows_sandbox: false },
    subagents: { enabled: false, max: 4 },
    power: { keep_awake: false, keep_screen_awake: true },
    mac: { liquid_glass: false },
    notifications: { enabled: false, sound: false },
    chrome: { enabled: false, disabled_tools: ["chrome_cdp"] },
    remote: { enabled: true, port: 5000 },
  };

  it("creates the settings directory first", async () => {
    const { mkdirs } = fakeFs({});
    await saveSettings(next);
    expect(mkdirs).toEqual([{ path: SETTINGS_DIR, recursive: true }]);
  });

  it("writes TOML that loads back to the same settings", async () => {
    const { writes } = fakeFs({});
    await saveSettings(next);
    expect(writes).toHaveLength(1);
    expect(parse(writes[0])).toEqual(next);
  });

  it("notifies every window of the change", async () => {
    fakeFs({});
    const received: Settings[] = [];
    await onSettingsChange((s) => received.push(s));
    await saveSettings(next);
    expect(received).toEqual([next]);
  });
});

describe("nextTextSize", () => {
  it.each([
    ["=", 13, 14],
    ["+", 13, 14],
    ["-", 13, 12],
    ["0", 20, 14],
    ["=", 24, 24],
    ["-", 10, 10],
  ])("%s from %d gives %d", (key, size, next) => {
    expect(nextTextSize(size, key)).toBe(next);
  });

  it("ignores other keys", () => {
    expect(nextTextSize(13, "k")).toBeNull();
  });
});
