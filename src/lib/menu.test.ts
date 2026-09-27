import { mockIPC } from "@tauri-apps/api/mocks";
import { describe, expect, it, vi } from "vitest";
import { APP_TITLE } from "./app";
import { menuItems, setAppMenu, type MenuHandlers } from "./menu";

const QUIT = `Quit ${APP_TITLE}`;

type Item = {
  text?: string;
  item?: unknown;
  items?: Item[];
  accelerator?: string;
  enabled?: boolean;
  action?: () => void;
};

function handlers(folders: string[]): MenuHandlers {
  return {
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

/** Every item, flattened across submenus. */
function all(items: Item[]): Item[] {
  return items.flatMap((i) => [i, ...all(i.items ?? [])]);
}

/** Finds a menu item by its text, searching submenus. */
function find(items: Item[], text: string): Item | undefined {
  for (const item of items) {
    if (item.text === text) return item;
    const inner = item.items && find(item.items, text);
    if (inner) return inner;
  }
}

const build = (h: MenuHandlers) => menuItems(h) as Item[];

describe("setAppMenu", () => {
  it("builds the menu and installs it as the app menu", async () => {
    const calls: string[] = [];
    mockIPC((cmd) => {
      calls.push(cmd);
      return cmd === "plugin:menu|new" ? [1, "menu"] : null;
    });
    await setAppMenu(handlers([]));
    expect(calls[calls.length - 1]).toBe("plugin:menu|set_as_app_menu");
  });
});

describe("menuItems", () => {
  it("keeps the standard Edit items so copy and paste work", () => {
    const edit = find(build(handlers([])), "Edit");
    const kinds = edit?.items?.map((i) => i.item);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "Undo",
        "Redo",
        "Cut",
        "Copy",
        "Paste",
        "SelectAll",
      ]),
    );
  });

  it("binds the expected shortcuts", () => {
    const items = build(handlers([]));
    expect(find(items, "Open Folder…")?.accelerator).toBe("CmdOrCtrl+O");
    expect(find(items, "New Window")?.accelerator).toBe("CmdOrCtrl+Shift+N");
    expect(find(items, "Settings…")?.accelerator).toBe("CmdOrCtrl+,");
    expect(find(items, "Close Tab")?.accelerator).toBe("CmdOrCtrl+W");
    expect(find(items, "Close Window")?.accelerator).toBe("CmdOrCtrl+Shift+W");
    expect(find(items, QUIT)?.accelerator).toBe("CmdOrCtrl+Q");
    expect(find(items, "Reload")?.accelerator).toBe("CmdOrCtrl+R");
  });

  it("never uses a shortcut twice", () => {
    const shortcuts = all(build(handlers(["/a"])))
      .map((i) => i.accelerator)
      .filter(Boolean);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("uses custom Quit and Close items so they can ask first", () => {
    // The predefined ones act immediately, skipping the confirmation.
    const kinds = all(build(handlers([]))).map((i) => i.item);
    expect(kinds).not.toContain("Quit");
    expect(kinds).not.toContain("CloseWindow");
  });

  it("reloads the page from the View menu", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    try {
      find(build(handlers([])), "Reload")?.action?.();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("wires actions to the handlers", () => {
    const h = handlers([]);
    const items = build(h);
    for (const text of [
      "Open Folder…",
      "Close Folder",
      "Settings…",
      "Close Tab",
      "Close Window",
      QUIT,
    ]) {
      find(items, text)?.action?.();
    }
    expect(h.openFolder).toHaveBeenCalledOnce();
    expect(h.closeFolder).toHaveBeenCalledOnce();
    expect(h.openSettings).toHaveBeenCalledOnce();
    expect(h.closeTab).toHaveBeenCalledOnce();
    expect(h.closeWindow).toHaveBeenCalledOnce();
    expect(h.quit).toHaveBeenCalledOnce();
  });

  describe("Open Recent", () => {
    it("with no folders, only offers a disabled Clear item", () => {
      const recent = find(build(handlers([])), "Open Recent");
      expect(recent?.items).toHaveLength(1);
      expect(recent?.items?.[0]).toMatchObject({
        text: "Clear Recently Opened",
        enabled: false,
      });
    });

    it("lists folders by label, then a separator and an enabled Clear", () => {
      const recent = find(build(handlers(["/a", "/b"])), "Open Recent");
      const items = recent?.items ?? [];
      expect(items.map((i) => i.text ?? i.item)).toEqual([
        "label:/a",
        "label:/b",
        "Separator",
        "Clear Recently Opened",
      ]);
      expect(items[3].enabled).toBe(true);
    });

    it("selects the folder for the clicked item", () => {
      const h = handlers(["/a", "/b"]);
      find(build(h), "label:/b")?.action?.();
      expect(h.selectFolder).toHaveBeenCalledWith("/b");
    });

    it("clears the list from the Clear item", () => {
      const h = handlers(["/a"]);
      find(build(h), "Clear Recently Opened")?.action?.();
      expect(h.clearFolders).toHaveBeenCalledOnce();
    });
  });
});
