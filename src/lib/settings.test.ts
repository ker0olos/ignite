import { parse } from "smol-toml";
import { describe, expect, it, vi } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import {
  DEFAULT_SETTINGS,
  approvalSetting,
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
      files: { hide_gitignored: false },
    });
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
      text_size: 14,
      chat_order: "oldest_first",
      sticky_user_messages: false,
      max_chats_enabled: false,
      max_chats: 5,
      resizable_sidebar_split: false,
    });
    fakeFs({ [FILE]: "[conversation]\nask_questions = false\n" });
    expect((await loadSettings()).conversation.ask_questions).toBe(false);
    fakeFs({ [FILE]: "[conversation]\nsticky_user_messages = true\n" });
    expect((await loadSettings()).conversation.sticky_user_messages).toBe(true);
  });

  it("reads whether the sidebar split is resizable", async () => {
    fakeFs({ [FILE]: "[conversation]\nresizable_sidebar_split = true\n" });
    expect((await loadSettings()).conversation.resizable_sidebar_split).toBe(
      true,
    );
    fakeFs({ [FILE]: '[conversation]\nresizable_sidebar_split = "yes"\n' });
    expect((await loadSettings()).conversation.resizable_sidebar_split).toBe(
      false,
    );
  });

  it("reads chat order settings", async () => {
    fakeFs({ [FILE]: '[conversation]\nchat_order = "newest_first"\n' });
    expect((await loadSettings()).conversation.chat_order).toBe("newest_first");
    fakeFs({ [FILE]: '[conversation]\nchat_order = "sideways"\n' });
    expect((await loadSettings()).conversation.chat_order).toBe("oldest_first");
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

  it.each([
    ["8", 8],
    ["99", 20],
    ["0", 1],
    ['"many"', 5],
  ])("reads max_chats = %s as %d", async (value, count) => {
    fakeFs({ [FILE]: `[conversation]\nmax_chats = ${value}\n` });
    expect((await loadSettings()).conversation.max_chats).toBe(count);
  });

  it("reads whether the sidebar chat limit is enabled", async () => {
    fakeFs({ [FILE]: "[conversation]\nmax_chats_enabled = true\n" });
    expect((await loadSettings()).conversation.max_chats_enabled).toBe(true);
  });

  it("reads memory settings", async () => {
    fakeFs({ [FILE]: "[memory]\ncmem = false\n" });
    expect((await loadSettings()).memory).toEqual({ cmem: false });
  });

  it.each(["manual", "yolo"] as const)(
    "reads the %s approval mode",
    async (mode) => {
      fakeFs({ [FILE]: `[approval]\nmode = "${mode}"\n` });
      expect((await loadSettings()).approval).toEqual({ mode });
    },
  );

  it("falls back to Auto for an approval mode it doesn't know", async () => {
    fakeFs({ [FILE]: '[approval]\nmode = "never"\n' });
    expect((await loadSettings()).approval).toEqual({ mode: "auto" });
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
      files: { hide_gitignored: false },
    });
  });
});

describe("approvalSetting", () => {
  it("offers the mode and saves a change without touching other settings", () => {
    const save = vi.fn(async () => {});
    const approval = approvalSetting(DEFAULT_SETTINGS, save);
    expect(approval.mode).toBe("auto");
    approval.onChange("manual");
    expect(save).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      approval: { mode: "manual" },
    });
  });
});

describe("saveSettings", () => {
  const next: Settings = {
    theme: "github-dark",
    editor: { font_family: "Monaco, monospace", word_wrap: true },
    files: { hide_gitignored: false },
    conversation: {
      show_thinking: true,
      ask_questions: false,
      text_size: 15,
      chat_order: "newest_first",
      sticky_user_messages: true,
      max_chats_enabled: true,
      max_chats: 8,
      resizable_sidebar_split: true,
    },
    memory: { cmem: false },
    approval: { mode: "manual" },
    subagents: { enabled: false, max: 4 },
    power: { keep_awake: false, keep_screen_awake: true },
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
