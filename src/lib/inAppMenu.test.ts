import { describe, expect, it, vi } from "vitest";
import { menuItems, type MenuHandlers } from "./menu";
import {
  entryForKey,
  matchesAccelerator,
  inAppMenuEntries,
  listedEntries,
  type MenuEntry,
} from "./inAppMenu";

function handlers(folders: string[]): MenuHandlers {
  return {
    version: null,
    checkForUpdates: vi.fn(),
    folders,
    label: (p) => `label:${p}`,
    openFolder: vi.fn(),
    selectFolder: vi.fn(),
    closeFolder: vi.fn(),
    clearFolders: vi.fn(),
    openSettings: vi.fn(),
    closeTab: vi.fn(),
    closeWindow: vi.fn(),
    quit: vi.fn(),
  };
}

const build = (folders: string[] = []) =>
  inAppMenuEntries(menuItems(handlers(folders)));
const labelOf = (e: MenuEntry) => (e === "separator" ? e : e.label);
const sub = (entries: MenuEntry[], label: string) => {
  const e = entries.find((x) => x !== "separator" && x.label === label);
  return e && e !== "separator" ? e : undefined;
};
const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);
const matches = (init: KeyboardEventInit, accelerator: string) =>
  matchesAccelerator(press(init), accelerator);

describe("inAppMenuEntries", () => {
  it("keeps File, View and the app menu last, and drops Edit and the empty Window menu", () => {
    expect(build().map(labelOf)).toEqual(["File", "View", "Ignite"]);
  });

  it("drops predefined items and the separators they leave", () => {
    const app = sub(build(), "Ignite")?.items ?? [];
    expect(app.map(labelOf)).toEqual([
      "Check for Updates…",
      "separator",
      "Settings",
      "separator",
      "Quit Ignite",
    ]);
  });

  it("formats shortcuts with Ctrl, and keeps the full screen toggle", () => {
    const file = sub(build(), "File")?.items ?? [];
    expect(sub(file, "New Window")).toMatchObject({ shortcut: "Ctrl+Shift+N" });
    expect(sub(file, "Close Tab")).toMatchObject({ shortcut: "Ctrl+W" });
    const view = sub(build(), "View")?.items ?? [];
    expect(sub(view, "Toggle Full Screen")).toMatchObject({ shortcut: "F11" });
  });

  it("keeps Open Recent's folders and Clear", () => {
    const file = sub(build(["/a"]), "File")?.items ?? [];
    expect(sub(file, "Open Recent")?.items?.map(labelOf)).toEqual([
      "label:/a",
      "separator",
      "Clear Recently Opened",
    ]);
  });
});

describe("listedEntries", () => {
  it("leaves out Settings, which has its own button, and the separator it leaves", () => {
    const app = sub(listedEntries(build()), "Ignite")?.items ?? [];
    expect(app.map(labelOf)).toEqual([
      "Check for Updates…",
      "separator",
      "Quit Ignite",
    ]);
  });
});

describe("matchesAccelerator", () => {
  it("needs exactly the accelerator's modifiers", () => {
    expect(matches({ key: "w", ctrlKey: true }, "CmdOrCtrl+W")).toBe(true);
    expect(
      matches({ key: "W", ctrlKey: true, shiftKey: true }, "CmdOrCtrl+Shift+W"),
    ).toBe(true);
    expect(
      matches({ key: "W", ctrlKey: true, shiftKey: true }, "CmdOrCtrl+W"),
    ).toBe(false);
    expect(matches({ key: "w" }, "CmdOrCtrl+W")).toBe(false);
    expect(
      matches({ key: "w", ctrlKey: true, altKey: true }, "CmdOrCtrl+W"),
    ).toBe(false);
  });

  it("matches F11 and comma", () => {
    expect(matches({ key: "F11" }, "F11")).toBe(true);
    expect(matches({ key: ",", ctrlKey: true }, "CmdOrCtrl+,")).toBe(true);
    expect(matches({ key: ".", ctrlKey: true }, "CmdOrCtrl+,")).toBe(false);
  });
});

describe("entryForKey", () => {
  it("finds an action inside a submenu and skips disabled entries", () => {
    const h = handlers([]);
    entryForKey(
      inAppMenuEntries(menuItems(h)),
      press({ key: "q", ctrlKey: true }),
    )?.();
    expect(h.quit).toHaveBeenCalledOnce();
    const disabled: MenuEntry[] = [
      { label: "X", shortcut: "Ctrl+X", enabled: false, action: vi.fn() },
    ];
    expect(
      entryForKey(disabled, press({ key: "x", ctrlKey: true })),
    ).toBeUndefined();
  });
});
