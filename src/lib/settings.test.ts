import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import {
  DEFAULT_SETTINGS,
  SETTINGS_DIR,
  SETTINGS_FILE,
  loadSettings,
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
      theme: "dracula",
      files: { hide_gitignored: false },
    });
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
      theme: DEFAULT_SETTINGS.theme,
      files: { hide_gitignored: false },
    });
  });
});

describe("saveSettings", () => {
  const next: Settings = {
    theme: "github-dark",
    files: { hide_gitignored: false },
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
